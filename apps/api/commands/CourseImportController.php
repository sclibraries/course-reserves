<?php
// filepath: /path/to/your/app/commands/CourseImportController.php

namespace app\commands;

use Yii;
use yii\console\Controller;
use yii\console\ExitCode;
use yii\helpers\Console;
;

/**
 * Imports legacy course data and maps it to FOLIO courses.
 */
class CourseImportController extends Controller
{
    /**
     * FOLIO API base URL
     */
    private $folioApiUrl = 'https://libtools2.smith.edu/folio/web/search';

/**
 * Import courses from CSV file
 * 
 * @param string $file Path to CSV file
 * @return int Exit code
 */
public function actionImport($file = null)
{
    if (!$file || !file_exists($file)) {
        $this->stderr("Error: File not found or not specified.\n", Console::FG_RED);
        return ExitCode::INPUT;
    }

    try {
        // Open CSV file
        $handle = fopen($file, "r");
        if ($handle === false) {
            throw new \Exception("Could not open file");
        }
        
        // Read header row
        $headers = fgetcsv($handle, 0, ","); // Using tab as delimiter
        if ($headers === false) {
            throw new \Exception("Empty or invalid CSV file");
        }
        
        // Find column indexes (case-insensitive)
        $headers = array_map('strtolower', $headers);
        $numberColIndex = array_search('number', $headers);
        $nameColIndex = array_search('name', $headers);
        $instructorColIndex = array_search('instructor', $headers);
        $termColIndex = array_search('created', $headers);
        $legacyIdColIndex = array_search('≈', $headers) !== false ? 
            array_search('≈', $headers) : 
            array_search('id', $headers);
        
        if ($numberColIndex === false || $nameColIndex === false) {
            $this->stderr("Error: Required columns not found. Need 'number' and 'name' columns.\n", Console::FG_RED);
            fclose($handle);
            return ExitCode::DATAERR;
        }
        
        // Read all rows into memory
        $rows = [];
        while (($row = fgetcsv($handle, 0, ",")) !== false) { // Using tab as delimiter
            // Skip empty rows
            if (isset($row[$numberColIndex]) && !empty($row[$numberColIndex])) {
                $rows[] = $row;
            }
        }
        fclose($handle);
        
        $this->stdout("Starting import of " . count($rows) . " courses...\n", Console::FG_GREEN);
        
        $processed = 0;
        $matched = 0;
        $notFound = 0;
        $errors = 0;
        
        $transaction = Yii::$app->db->beginTransaction();
        
        try {
            foreach ($rows as $i => $row) {
                $courseNumber = trim($row[$numberColIndex]);
                $courseName = trim($row[$nameColIndex]);
                $legacyId = !empty($row[$legacyIdColIndex]) ? intval(trim($row[$legacyIdColIndex])) : null;
                $instructor = !empty($row[$instructorColIndex]) ? trim($row[$instructorColIndex]) : null;
                $term = !empty($row[$termColIndex]) ? trim($row[$termColIndex]) : null;
                
                $this->stdout("\nProcessing [{$processed}]: {$courseNumber} - {$courseName}\n", Console::FG_YELLOW);
                
                // Query FOLIO API for course info
                $folioData = $this->queryFolioApi($courseNumber, $instructor);

                if (empty($folioData['courses']) || !is_array($folioData['courses']) || count($folioData['courses']) === 0) {
                    $this->stdout("  No FOLIO course found, creating stub entry.\n", Console::FG_RED);
                    $notFound++;
                    
                    // Create course with UUID but without FOLIO connection
                    $permanentCourseUuid = $this->generateUuid();
                    $this->createCourse($permanentCourseUuid, $courseName, $courseNumber, $legacyId);
                    
                } else {
                    $matched++;
                        
                        // Courses are already in array format in the response
                        $folioCourses = $folioData['courses'];
                        
                        // Find matching course with term
                        $matchedCourse = null;
                        $matchedTerm = null;
                        
                        foreach ($folioCourses as $folioCourse) {
                            if (!isset($folioCourse['courseListingObject']['termObject'])) {
                                continue;
                            }
                            
                            $folioTermName = $folioCourse['courseListingObject']['termObject']['name'];
                            
                            // Extract term from the course name if needed
                            if (!$term) {
                                $termPattern = '/(Spring|Summer|Fall|Winter)\s+\d{4}/i';
                                if (preg_match($termPattern, $courseName, $matches)) {
                                    $term = $matches[0];
                                }
                            }
                            
                            // Convert term formats and check match
                            if ($term && $this->isTermMatch($term, $folioTermName)) {
                                $matchedCourse = $folioCourse;
                                $matchedTerm = $folioCourse['courseListingObject']['termObject'];
                                $this->stdout("  Found matching term: {$folioTermName} for {$term}\n", Console::FG_GREEN);
                                break;
                            }
                        }
                        
                        // If no term match but we have courses, use the first one
                        if (!$matchedCourse && !empty($folioCourses)) {
                            $matchedCourse = $folioCourses[0];
                            if (isset($matchedCourse['courseListingObject']['termObject'])) {
                                $matchedTerm = $matchedCourse['courseListingObject']['termObject'];
                                $this->stdout("  Using first available course with term: {$matchedTerm['name']}\n", Console::FG_YELLOW);
                            }
                        }
                    
                        // Extract department and location info with proper path checking
                        $departmentId = $matchedCourse['departmentId'] ?? null;
                        $departmentName = null;
                        if (isset($matchedCourse['departmentObject']) && isset($matchedCourse['departmentObject']['name'])) {
                            $departmentName = $matchedCourse['departmentObject']['name'];
                        }
                        // Extract location data from courseListingObject
                        $locationId = null;
                        $locationName = null;
                        if (isset($matchedCourse['courseListingObject'])) {
                            $locationId = $matchedCourse['courseListingObject']['locationId'] ?? null;
                            
                            if (isset($matchedCourse['courseListingObject']['locationObject']) && 
                                isset($matchedCourse['courseListingObject']['locationObject']['name'])) {
                                $locationName = $matchedCourse['courseListingObject']['locationObject']['name'];
                            }
                        }
                    // Debug output to verify extraction
                    $this->stdout("  Department: {$departmentId} - {$departmentName}\n", Console::FG_BLUE);
                    $this->stdout("  Location: {$locationId} - {$locationName}\n", Console::FG_BLUE);
                    // Create course entry with FOLIO data
                    $permanentCourseUuid = $this->generateUuid();
                    $courseId = $this->createCourse(
                        $permanentCourseUuid, 
                        $courseName, 
                        $courseNumber, 
                        $legacyId,
                        $departmentId,
                        $departmentName,
                        $locationId,
                        $locationName
                    );
                    
                    // Create course offering if we have term info
                    if ($matchedTerm && $courseId) {
                        $this->createCourseOffering(
                            $courseId,
                            $matchedCourse['courseListingObject']['id'] ?? null,
                            $matchedTerm['id'],
                            $matchedTerm['name'],
                            $matchedTerm['startDate'],
                            $matchedTerm['endDate']
                        );
                        
                        $this->stdout("  Created course and offering with term: {$matchedTerm['name']}\n", Console::FG_GREEN);
                    } else {
                        $this->stdout("  Created course but no matching term found\n", Console::FG_YELLOW);
                    }
                }
                
                $processed++;
                
                // Show progress every 10 records
                if ($processed % 10 == 0) {
                    $this->stdout("Processed: $processed / " . count($rows) . "\n");
                }
            }
            
            $transaction->commit();
            $this->stdout("\nImport completed successfully!\n", Console::FG_GREEN);
            $this->stdout("Processed: $processed, Matched: $matched, Not Found: $notFound, Errors: $errors\n");
            
            return ExitCode::OK;
            
        } catch (\Exception $e) {
            $transaction->rollBack();
            $this->stderr("Error during import: " . $e->getMessage() . "\n", Console::FG_RED);
            $this->stderr("Stack trace: " . $e->getTraceAsString() . "\n", Console::FG_RED);
            return ExitCode::SOFTWARE;
        }
        
    } catch (\Exception $e) {
        $this->stderr("Error reading CSV file: " . $e->getMessage() . "\n", Console::FG_RED);
        return ExitCode::IOERR;
    }
}
    
    /**
     * Generate a UUID v4
     * 
     * @return string UUID
     */
    private function generateUuid()
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
    
/**
 * Query FOLIO API for course info
 * 
 * @param string $courseNumber Course number/code
 * @param string|null $instructor Optional instructor name
 * @return array Course data
 */
private function queryFolioApi($courseNumber, $instructor = null)
{
    // Base query with department wildcard and course number
    $queryParts = [
        'department.name=="SC*"',
        "(name=\"{$courseNumber}*\" or courseNumber=\"{$courseNumber}*\" or sectionName=\"{$courseNumber}*\" or courseListing.registrarId=\"{$courseNumber}*\")"
    ];
    
    $query = implode(' and ', $queryParts);
    $encodedQuery = urlencode("({$query}) sortby name");
    $url = "{$this->folioApiUrl}/search-courses?query={$encodedQuery}";
    
    $this->stdout("  Querying FOLIO API: " . $url . "\n", Console::FG_BLUE);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    // Tell server we want JSON response
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);
    
    $jsonResponse = curl_exec($ch);
    
    if (curl_errno($ch)) {
        $this->stderr("  cURL error: " . curl_error($ch) . "\n", Console::FG_RED);
        curl_close($ch);
        return [];
    }
    
    curl_close($ch);
    
    // Parse JSON directly
    $data = json_decode($jsonResponse, true);
    
    // Check for JSON decode errors
    if (json_last_error() !== JSON_ERROR_NONE) {
        $this->stderr("  JSON parse error: " . json_last_error_msg() . "\n", Console::FG_RED);
        $this->stdout("  First 200 chars of response: " . substr($jsonResponse, 0, 200) . "...\n", Console::FG_YELLOW);
        return [];
    }
    
    // Debug response structure
    $this->stdout("  Received response with status: " . ($data['message'] ?? 'unknown') . "\n", Console::FG_BLUE);
    
    // Check if we have valid data with courses array
    if (isset($data['data']) && isset($data['data']['courses']) && is_array($data['data']['courses'])) {
        $this->stdout("  Found " . count($data['data']['courses']) . " courses in response\n", Console::FG_GREEN);
        return $data['data'];
    }
    
    $this->stdout("  No courses found in response\n", Console::FG_YELLOW);
    return [];
}
    
    /**
     * Create course record in the database
     * 
     * @param string $uuid UUID for the course
     * @param string $courseName Course name
     * @param string $courseNumber Course number/code
     * @param int|null $legacyId Legacy course ID
     * @param string|null $departmentId Department ID from FOLIO
     * @param string|null $departmentName Department name from FOLIO
     * @param string|null $locationId Location ID from FOLIO
     * @param string|null $locationName Location name from FOLIO
     * @return int|false The course ID or false on failure
     */
    private function createCourse($uuid, $courseName, $courseNumber, $legacyId = null, 
                                 $departmentId = null, $departmentName = null, 
                                 $locationId = null, $locationName = null)
    {
        return Yii::$app->db->createCommand()->insert('courses', [
            'permanent_course_uuid' => $uuid,
            'course_name' => $courseName,
            'course_number' => $courseNumber,
            'legacy_course_id' => $legacyId,
            'department_id' => $departmentId,
            'department_name' => $departmentName,
            'location_id' => $locationId,
            'location_name' => $locationName,
        ])->execute() ? Yii::$app->db->getLastInsertID() : false;
    }
    
        /**
         * Create course offering record in the database
         * 
         * @param int $courseId Internal course ID
         * @param string|null $folioCourseId FOLIO course listing ID
         * @param string $termId FOLIO term ID
         * @param string $termName Term name
         * @param string $startDate Term start date
         * @param string $endDate Term end date
         * @return bool Success
         */
        private function createCourseOffering($courseId, $folioCourseId, $termId, $termName, $startDate, $endDate)
        {
            // Convert ISO 8601 format to MySQL compatible datetime
            $formattedStartDate = $this->formatDateForMysql($startDate);
            $formattedEndDate = $this->formatDateForMysql($endDate);
            
            // Determine if the term is active based on current date
            $startDateTime = new \DateTime($formattedStartDate);
            $endDateTime = new \DateTime($formattedEndDate);
            $now = new \DateTime();
            $isActive = ($now >= $startDateTime && $now <= $endDateTime) ? 'active' : 'inactive';
            
            $this->stdout("  Creating offering: {$termName} ({$formattedStartDate} to {$formattedEndDate})\n", Console::FG_BLUE);
            
            return Yii::$app->db->createCommand()->insert('course_offerings', [
                'course_id' => $courseId,
                'folio_course_id' => $folioCourseId,
                'term_id' => $termId,
                'term_name' => $termName,
                'start_date' => $formattedStartDate,
                'end_date' => $formattedEndDate,
                'status' => $isActive,
            ])->execute();
        }


    /**
         * Format ISO 8601 date for MySQL database
         * 
         * @param string $dateString ISO 8601 date string (e.g. '2024-05-14T04:00:00.000Z')
         * @return string MySQL formatted date (YYYY-MM-DD HH:MM:SS)
         */
        private function formatDateForMysql($dateString)
        {
            try {
                // Create DateTime object from ISO 8601 string
                $date = new \DateTime($dateString);
                
                // Format in MySQL compatible format
                return $date->format('Y-m-d H:i:s');
            } catch (\Exception $e) {
                $this->stderr("  Error formatting date '{$dateString}': " . $e->getMessage() . "\n", Console::FG_RED);
                // Return a fallback date
                return date('Y-m-d H:i:s');
            }
        }    
    /**
     * Check if two term strings match
     * 
     * @param string $excelTerm Term from Excel (e.g., "Summer 2024")
     * @param string $folioTerm Term from FOLIO (e.g., "2024 Summer")
     * @return bool Whether terms match
     */
    private function isTermMatch($excelTerm, $folioTerm)
    {
        if (!$excelTerm || !$folioTerm) {
            return false;
        }
        
        // Normalize the terms for comparison
        $normalizePattern = '/[^a-z0-9]/i';
        $normalizedExcel = preg_replace($normalizePattern, '', strtolower($excelTerm));
        $normalizedFolio = preg_replace($normalizePattern, '', strtolower($folioTerm));
        
        // Direct match
        if ($normalizedExcel === $normalizedFolio) {
            return true;
        }
        
        // Extract year and season
        preg_match('/(\d{4})/', $excelTerm, $excelYearMatch);
        preg_match('/(\d{4})/', $folioTerm, $folioYearMatch);
        
        if (!empty($excelYearMatch[1]) && !empty($folioYearMatch[1])) {
            $excelYear = $excelYearMatch[1];
            $folioYear = $folioYearMatch[1];
            
            $seasons = ['spring', 'summer', 'fall', 'winter'];
            
            foreach ($seasons as $season) {
                if (stripos($excelTerm, $season) !== false && stripos($folioTerm, $season) !== false) {
                    // If both have the same year and season, consider it a match
                    if ($excelYear === $folioYear) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * Display debug information for testing
     */
    public function actionTest($courseNumber)
    {
        $this->stdout("Testing API query for: $courseNumber\n", Console::FG_YELLOW);
        
        $folioData = $this->queryFolioApi($courseNumber);
        
        if (empty($folioData)) {
            $this->stdout("No data found.\n", Console::FG_RED);
            return ExitCode::OK;
        }
        
        $this->stdout("Results: " . print_r($folioData, true) . "\n", Console::FG_GREEN);
        return ExitCode::OK;
    }

/**
 * Import resources from CSV and link to courses
 * 
 * @param string $file Path to resources CSV file
 * @return int Exit code
 */
public function actionImportResources($file = null)
{
    if (!$file || !file_exists($file)) {
        $this->stderr("Error: Resource file not found or not specified.\n", Console::FG_RED);
        return ExitCode::INPUT;
    }

    try {
        // Open CSV file
        $handle = fopen($file, "r");
        if ($handle === false) {
            throw new \Exception("Could not open file");
        }
        
        // Read header row and detect delimiter
        $firstLine = fgets($handle);
        rewind($handle);
        
        $delimiter = ",";  // Default to comma
        if (strpos($firstLine, "\t") !== false) {
            $delimiter = "\t"; // Use tab if detected
            $this->stdout("Using tab delimiter\n", Console::FG_YELLOW);
        } else {
            $this->stdout("Using comma delimiter\n", Console::FG_YELLOW);
        }
        
        $headers = fgetcsv($handle, 0, $delimiter);
        if ($headers === false) {
            throw new \Exception("Empty or invalid CSV file");
        }
        
        // Find column indexes
        $headers = array_map('strtolower', $headers);
        $idColIndex = array_search('id', $headers);
        $typeColIndex = array_search('type', $headers);
        $nameColIndex = array_search('name', $headers);
        $descriptionColIndex = array_search('description', $headers);
        $urlColIndex = array_search('url', $headers);
        $proxyColIndex = array_search('proxy', $headers);
        $courseIdsColIndex = array_search('course_ids', $headers);
        
        if ($idColIndex === false || $nameColIndex === false || $urlColIndex === false) {
            $this->stderr("Error: Required columns not found. Need 'id', 'name', and 'url' columns.\n", Console::FG_RED);
            fclose($handle);
            return ExitCode::DATAERR;
        }
        
        // Read all rows
        $rows = [];
        while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
            if (!empty($row[$idColIndex])) {
                $rows[] = $row;
            }
        }
        fclose($handle);
        
        $this->stdout("Starting import of " . count($rows) . " resources...\n", Console::FG_GREEN);
        
        $processed = 0;
        $linked = 0;
        $notLinked = 0;
        
        $transaction = Yii::$app->db->beginTransaction();
        
        try {
            foreach ($rows as $i => $row) {
                $legacyResourceId = intval(trim($row[$idColIndex]));
                $resourceName = trim($row[$nameColIndex]);
                $resourceType = isset($row[$typeColIndex]) ? trim($row[$typeColIndex]) : null;
                $resourceDescription = isset($row[$descriptionColIndex]) ? trim($row[$descriptionColIndex]) : null;
                $resourceUrl = isset($row[$urlColIndex]) ? trim($row[$urlColIndex]) : null;
                $useProxy = isset($row[$proxyColIndex]) ? (intval(trim($row[$proxyColIndex])) === 1) : false;
                $courseIds = isset($row[$courseIdsColIndex]) ? trim($row[$courseIdsColIndex]) : null;
                
                $this->stdout("\nProcessing resource [{$processed}]: {$resourceName}\n", Console::FG_YELLOW);
                
                // Check if resource already exists
                $existingResource = Yii::$app->db->createCommand("
                    SELECT resource_id FROM resources WHERE legacy_resource_id = :legacyId
                ")->bindValue(':legacyId', $legacyResourceId)->queryOne();
                
                $resourceId = null;
                if ($existingResource) {
                    $resourceId = $existingResource['resource_id'];
                    $this->stdout("  Resource already exists (ID: {$resourceId})\n", Console::FG_BLUE);
                } else {
                    // Determine material type ID based on type string
                    $materialTypeId = $this->getMaterialTypeId($resourceType);
                    
                    // Create the resource
                    Yii::$app->db->createCommand()->insert('resources', [
                        'legacy_resource_id' => $legacyResourceId,
                        'name' => $this->sanitizeText($resourceName),
                        'item_url' => $resourceUrl,
                        'use_proxy' => $useProxy ? 1 : 0,
                        'description' => $this->sanitizeText($resourceDescription),
                        'material_type_id' => $materialTypeId,
                    ])->execute();
                    
                    $resourceId = Yii::$app->db->getLastInsertID();
                    $this->stdout("  Created resource (ID: {$resourceId})\n", Console::FG_GREEN);
                }
                
                // Link the resource to courses
                if (!empty($courseIds)) {
                    $courseIdArray = explode(',', $courseIds);
                    
                    foreach ($courseIdArray as $legacyCourseId) {
                        $legacyCourseId = trim($legacyCourseId);
                        if (empty($legacyCourseId)) continue;
                        
                        // Find the course by legacy ID
                        $course = Yii::$app->db->createCommand("
                            SELECT course_id FROM courses WHERE legacy_course_id = :legacyId
                        ")->bindValue(':legacyId', $legacyCourseId)->queryOne();
                        
                        if ($course) {
                            $courseId = $course['course_id'];
                            
                            // Get all offerings for this course
                            $offerings = Yii::$app->db->createCommand("
                                SELECT offering_id FROM course_offerings WHERE course_id = :courseId
                            ")->bindValue(':courseId', $courseId)->queryAll();
                            
                            if (!empty($offerings)) {
                                foreach ($offerings as $offering) {
                                    $offeringId = $offering['offering_id'];
                                    
                                    // Check if link already exists
                                    $existingLink = Yii::$app->db->createCommand("
                                        SELECT course_resource_id FROM course_resources 
                                        WHERE offering_id = :offeringId AND resource_id = :resourceId
                                    ")->bindValues([
                                        ':offeringId' => $offeringId,
                                        ':resourceId' => $resourceId
                                    ])->queryOne();
                                    
                                    if (!$existingLink) {
                                        // Create the link
                                        Yii::$app->db->createCommand()->insert('course_resources', [
                                            'offering_id' => $offeringId,
                                            'resource_id' => $resourceId
                                        ])->execute();
                                        
                                        $linked++;
                                        $this->stdout("  Linked resource to course offering ID: {$offeringId}\n", Console::FG_GREEN);
                                    } else {
                                        $this->stdout("  Resource already linked to offering ID: {$offeringId}\n", Console::FG_BLUE);
                                    }
                                }
                            } else {
                                $this->stdout("  No offerings found for course ID: {$courseId} (legacy ID: {$legacyCourseId})\n", Console::FG_YELLOW);
                                $notLinked++;
                            }
                        } else {
                            $this->stdout("  No course found with legacy ID: {$legacyCourseId}\n", Console::FG_RED);
                            $notLinked++;
                        }
                    }
                }
                
                $processed++;
                
                // Show progress
                if ($processed % 10 == 0) {
                    $this->stdout("Processed: $processed / " . count($rows) . "\n");
                }
            }
            
            $transaction->commit();
            $this->stdout("\nResource import completed successfully!\n", Console::FG_GREEN);
            $this->stdout("Processed: $processed, Linked: $linked, Not linked: $notLinked\n");
            
            return ExitCode::OK;
            
        } catch (\Exception $e) {
            $transaction->rollBack();
            $this->stderr("Error during resource import: " . $e->getMessage() . "\n", Console::FG_RED);
            return ExitCode::SOFTWARE;
        }
    } catch (\Exception $e) {
        $this->stderr("Error reading resource CSV file: " . $e->getMessage() . "\n", Console::FG_RED);
        return ExitCode::IOERR;
    }
}

/**
 * Get material type ID based on type string
 * Creates a new material type if not found
 * 
 * @param string|null $typeString Type string from CSV
 * @return int|null Material type ID or null if no type provided
 */
private function getMaterialTypeId($typeString)
{
    if (empty($typeString)) {
        return null;
    }
    
    // Try to map the type string to existing material types
    $mappings = [
        'book' => ['book', 'ebook', 'e-book', 'chapter'],
        'article' => ['article', 'journal', 'paper'],
        'media' => ['media', 'audio', 'video', 'dvd', 'cd'],
        'website' => ['website', 'web', 'online', 'url'],
        'instructor' => ['instructor', 'syllabus', 'handout']
    ];
    
    $typeStringLower = strtolower($typeString);
    $typeToUse = null;
    
    // Try to match with existing types
    foreach ($mappings as $materialType => $keywords) {
        foreach ($keywords as $keyword) {
            if (strpos($typeStringLower, $keyword) !== false) {
                $typeToUse = $materialType;
                break 2;
            }
        }
    }
    
    // If we found a matching type, get its ID
    if ($typeToUse) {
        $this->stdout("  Mapped '{$typeString}' to existing type '{$typeToUse}'\n", Console::FG_BLUE);
        $materialType = Yii::$app->db->createCommand("
            SELECT material_type_id FROM material_types WHERE name = :name
        ")->bindValue(':name', $typeToUse)->queryOne();
        
        if ($materialType) {
            return $materialType['material_type_id'];
        }
    }
    
    // If no existing type matched, try to find the exact type
    $materialType = Yii::$app->db->createCommand("
        SELECT material_type_id FROM material_types WHERE name = :name
    ")->bindValue(':name', $typeString)->queryOne();
    
    if ($materialType) {
        return $materialType['material_type_id'];
    }
    
    // Create new material type with just name and description
    $this->stdout("  Creating new material type: '{$typeString}'\n", Console::FG_GREEN);
    Yii::$app->db->createCommand()->insert('material_types', [
        'name' => $typeString,
        'description' => $typeString
    ])->execute();
    
    return Yii::$app->db->getLastInsertID();
    }

        /**
         * Sanitize text for safe database insertion
         * 
         * @param string|null $text Text to sanitize
         * @return string|null Sanitized text
         */
        private function sanitizeText($text)
        {
            if ($text === null) {
                return null;
            }
            
            // Replace problematic invisible characters (like LINE SEPARATOR \u2028 causing the issue)
            $text = preg_replace('/\p{C}/u', ' ', $text);
            
            // Remove any non-UTF8 sequences
            $text = iconv('UTF-8', 'UTF-8//IGNORE', $text);
            
            // Additional cleanup if needed
            $text = str_replace(["\r", "\n\n\n"], ["\n", "\n\n"], $text);
            
            return $text;
        }
}