<?php
namespace app\controllers;

use Yii;
use yii\rest\ActiveController;
use yii\filters\auth\HttpBearerAuth;
use yii\web\BadRequestHttpException;
use yii\httpclient\Client;
use yii\web\Response;
use yii\filters\ContentNegotiator;
use yii\filters\Cors;
use yii\web\TooManyRequestsHttpException;

class EbscoSearchController extends ActiveController
{
    public $modelClass = '';

    private $baseAuthUrl = 'https://eds-api.ebscohost.com/authservice/rest';
    private $baseApiUrl = 'https://eds-api.ebscohost.com/edsapi/rest';
    private $authToken;
    private $sessionToken;

    public function behaviors()
    {
        $behaviors = parent::behaviors();

        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => ['options'],
        ];

        // Configure content negotiator
        $behaviors['contentNegotiator'] = [
            'class' => ContentNegotiator::class,
            'formats' => [
                'application/json' => Response::FORMAT_JSON,
            ],
        ];

        // CORS filter if needed
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge([
                    'http://localhost:3001',
                    'http://localhost:5173',
                    'http://localhost:5174',
                    'http://localhost:8080',
                    'http://127.0.0.1:3001',
                    'http://127.0.0.1:5173',
                    'http://127.0.0.1:5174',
                    'http://127.0.0.1:8080',
                ], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
                'Access-Control-Request-Headers' => ['*'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 86400,
            ],
        ];

        return $behaviors;
    }

    public function beforeAction($action)
    {
        if (Yii::$app->request->method === 'OPTIONS') {
            $this->sendCorsPreflightResponse();
        }

        if (!parent::beforeAction($action)) {
            return false;
        }

        if ($action->id === 'options' || Yii::$app->request->method === 'OPTIONS') {
            return true;
        }

        $this->enforceProxyRateLimit();

        return true;
    }

    public function actionOptions()
    {
        $this->sendCorsPreflightResponse();
    }

    private function sendCorsPreflightResponse()
    {
        $origin = Yii::$app->request->headers->get('Origin');
        $allowedOrigins = $this->behaviors()['corsFilter']['cors']['Origin'];

        Yii::$app->response->statusCode = 204;
        if (in_array($origin, $allowedOrigins, true)) {
            Yii::$app->response->headers->set('Access-Control-Allow-Origin', $origin);
            Yii::$app->response->headers->set('Access-Control-Allow-Credentials', 'true');
        }
        Yii::$app->response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS');
        Yii::$app->response->headers->set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');
        Yii::$app->response->headers->set('Access-Control-Max-Age', '86400');
        Yii::$app->end();
    }

    protected function getProxyRateLimit(): int
    {
        return 60;
    }

    protected function getProxyRateWindowSeconds(): int
    {
        return 60;
    }

    private function enforceProxyRateLimit(): void
    {
        $cache = Yii::$app->cache;
        $key = $this->getProxyRateLimitKey();

        if ($cache->add($key, 1, $this->getProxyRateWindowSeconds())) {
            return;
        }

        $requestCount = (int)$cache->get($key);
        if ($requestCount >= $this->getProxyRateLimit()) {
            throw new TooManyRequestsHttpException('EBSCO proxy rate limit exceeded.');
        }

        $cache->set($key, $requestCount + 1, $this->getProxyRateWindowSeconds());
    }

    private function getProxyRateLimitKey(): string
    {
        $identity = Yii::$app->user->identity;
        $actor = $identity ? ($identity->getId() ?: $identity->username ?: 'authenticated') : Yii::$app->request->userIP;

        return 'ebsco_proxy_rate:' . sha1((string)$actor);
    }

    public function actionSearch($query)
    {
        $client = new Client();
        
        try {
            // 1. Authenticate
            $this->authenticate($client);
    
            // 2. Create session
            $this->createSession($client);
    
            // 3. Get additional parameters from request
            $request = Yii::$app->request;
            $searchParams = [
                'sort' => $request->get('sort', 'relevance'),
                'searchmode' => $request->get('searchmode', 'all'),
                'resultsperpage' => (int)$request->get('resultsperpage', 20),
                'pagenumber' => (int)$request->get('pagenumber', 1),
                'highlight' => $request->get('highlight', 'y'),
                'includefacets' => $request->get('includefacets', 'n'),
                'autosuggest' => $request->get('autosuggest', 'n'),
                'autocorrect' => $request->get('autocorrect', 'n'),
                'view' => $request->get('view', 'detailed'),
                'includeimagequickview' => $request->get('includeimagequickview', 'n'),
            ];
            
            // 4. Get action parameters (facetfilter, limiter, expander, action, relatedcontent)
            $actionParams = [];
            
            // Handle EBSCO action parameter (e.g., GoToPage(2), AddFacetFilter(...), SetSort(...))
            $action = $request->get('action');
            if (!empty($action)) {
                $actionParams['action'] = $action;
            }
            
            // Handle facet filters - can be single or array
            $facetfilter = $request->get('facetfilter');
            if (!empty($facetfilter)) {
                // EBSCO expects facetfilter as comma-separated or multiple params
                if (is_array($facetfilter)) {
                    // Multiple facet filters - pass as facetfilter-1, facetfilter-2, etc.
                    $i = 1;
                    foreach ($facetfilter as $ff) {
                        $actionParams['facetfilter-' . $i] = $ff;
                        $i++;
                    }
                } else {
                    $actionParams['facetfilter'] = $facetfilter;
                }
            }
            
            // Handle limiters - can be single or array
            $limiter = $request->get('limiter');
            if (!empty($limiter)) {
                if (is_array($limiter)) {
                    $i = 1;
                    foreach ($limiter as $lim) {
                        $actionParams['limiter-' . $i] = $lim;
                        $i++;
                    }
                } else {
                    $actionParams['limiter'] = $limiter;
                }
            }
            
            // Handle expanders - can be single or array
            $expander = $request->get('expander');
            if (!empty($expander)) {
                if (is_array($expander)) {
                    $actionParams['expander'] = implode(',', $expander);
                } else {
                    $actionParams['expander'] = $expander;
                }
            }
            
            // Handle related content
            $relatedcontent = $request->get('relatedcontent');
            if (!empty($relatedcontent)) {
                $actionParams['relatedcontent'] = $relatedcontent;
            }
            
            // 5. Sanitize the query for proper UTF-8 encoding (handles diacritics, special chars)
            $query = $this->sanitizeUtf8Query($query);

            // 6. Check if query is already in EBSCO format (query-1=AND,term)
            if (preg_match('/^query-\d+=/', $query)) {
                // Query is pre-formatted - parse it
                $processedQuery = $this->parseEbscoQueryString($query);
            } else {
                // Simple search term - escape and format
                $escapedQuery = $this->escapeEbscoQuery($query);
                $processedQuery = ['query-1' => 'AND,' . $escapedQuery];
            }
    
            // 7. Perform search with processed query, params, and actions
            $results = $this->performSearch($client, $processedQuery, $searchParams, $actionParams);
    
            // 8. End session
            $this->endSession($client);
    
            return $this->formatResponse($results);
    
        } catch (\Exception $e) {
            throw new BadRequestHttpException($e->getMessage());
        }
    }
    
    /**
     * Parse an EBSCO-formatted query string into array
     * e.g., "query-1=AND,black africa" => ['query-1' => 'AND,black africa']
     */
    private function parseEbscoQueryString($queryString)
    {
        $queries = [];
        // Split by & in case there are multiple query-N parameters
        $parts = explode('&', $queryString);
        foreach ($parts as $part) {
            if (preg_match('/^(query-\d+)=(.+)$/', $part, $matches)) {
                // Note: Do NOT urldecode() here - Yii2 already decodes GET parameters.
                // Double-decoding corrupts UTF-8 characters like diacritics (e.g. é, ñ, ü).
                $value = $matches[2];
                // Sanitize each query value for proper UTF-8 encoding
                $queries[$matches[1]] = $this->sanitizeUtf8Query($value);
            }
        }
        // If parsing failed, treat as simple query
        if (empty($queries)) {
            return ['query-1' => 'AND,' . $this->escapeEbscoQuery($queryString)];
        }
        return $queries;
    }


    private function escapeEbscoQuery($query)
    {
        // Ensure proper UTF-8 encoding before escaping
        $query = $this->sanitizeUtf8Query($query);
        
        // Escape EBSCO special characters
        $query = str_replace(',', '\,', $query);
        $query = str_replace(':', '\:', $query);
        $query = str_replace('(', '\(', $query);
        $query = str_replace(')', '\)', $query);
        $query = str_replace('+', '%2b', $query);
        // If you need to remove double quotes, uncomment the next line
        // $query = str_replace('"', '', $query);
        return $query;
    }

    /**
     * Sanitize a query string for proper UTF-8 encoding.
     * Handles diacritics (é, ñ, ü, etc.), special characters, and encoding mismatches.
     * Ensures the string sent to EBSCO is valid, NFC-normalized UTF-8.
     */
    private function sanitizeUtf8Query($query)
    {
        if (empty($query)) {
            return $query;
        }

        // 1. If the string is not valid UTF-8, attempt to convert from common encodings
        if (!mb_check_encoding($query, 'UTF-8')) {
            // Try Windows-1252 first (superset of Latin-1, common in web contexts)
            $converted = @mb_convert_encoding($query, 'UTF-8', 'Windows-1252');
            if ($converted !== false && mb_check_encoding($converted, 'UTF-8')) {
                $query = $converted;
            } else {
                // Fallback: force to UTF-8, replacing invalid sequences
                $query = mb_convert_encoding($query, 'UTF-8', 'UTF-8');
            }
        }

        // 2. Remove invalid UTF-8 byte sequences (e.g., orphaned continuation bytes)
        $query = mb_convert_encoding($query, 'UTF-8', 'UTF-8');

        // 3. Normalize Unicode to NFC (Canonical Decomposition + Canonical Composition)
        //    This ensures characters like é are stored as a single codepoint (U+00E9)
        //    rather than e + combining acute accent (U+0065 U+0301).
        if (class_exists('Normalizer')) {
            // Use intl extension if available
            $query = \Normalizer::normalize($query, \Normalizer::FORM_C);
        } else {
            // Fallback: use iconv to normalize — round-trip through a compatible encoding
            // This handles the most common composed/decomposed equivalences
            $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $query);
            if ($converted !== false) {
                $query = $converted;
            }
        }

        // 4. Remove null bytes and other control characters that could break the API
        $query = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $query);

        return $query;
    }

    

    public function actionRetrieve($dbId, $an)
    {
        $client = new Client();
        
        try {
            // 1. Authenticate (creates $this->authToken)
            $this->authenticate($client);

            // 2. Create session (creates $this->sessionToken)
            $this->createSession($client);

            // 3. Retrieve single record
            $recordData = $this->performRetrieve($client, $dbId, $an);

            // 4. End session (if you don’t plan on more calls right now)
            $this->endSession($client);

            // 5. Format and return the response
            return $this->formatResponse($recordData);

        } catch (\Exception $e) {
            throw new BadRequestHttpException($e->getMessage());
        }
    }

    /**
     * Get EBSCO Info - returns available options, limiters, expanders, sort options, etc.
     * @return array
     */
    public function actionInfo()
    {
        $client = new Client();
        
        try {
            // 1. Authenticate
            $this->authenticate($client);
    
            // 2. Create session
            $this->createSession($client);
    
            // 3. Get Info
            $infoData = $this->performInfo($client);
    
            // 4. End session
            $this->endSession($client);
    
            return $this->formatResponse($infoData);
    
        } catch (\Exception $e) {
            throw new BadRequestHttpException($e->getMessage());
        }
    }


    private function authenticate(Client $client)
    {
        // IMPORTANT: Use createRequest() + setHeaders() + setContent() or setFormat() + setData()
        $response = $client->createRequest()
            ->setMethod('POST')
            ->setUrl($this->baseAuthUrl . '/uidauth')
            ->addHeaders([
                'Content-Type' => 'application/json',
                'Accept'       => 'application/json',
                'charset'      => 'utf-8', // optional, but matches your Node code
            ])
            ->setFormat(Client::FORMAT_JSON)  // tells Yii2 to encode setData() as JSON
            ->setData([
                'UserId'      => Yii::$app->params['ebsco']['userId'],
                'Password'    => Yii::$app->params['ebsco']['password'],
                'InterfaceId' => Yii::$app->params['ebsco']['edsProfile'],
            ])
            ->send();

        if (!$response->isOk) {
            throw new \Exception('Authentication failed: ' . $response->content);
        }

        $data = $response->getData();
        if (empty($data['AuthToken'])) {
            throw new \Exception('Invalid authentication response. No AuthToken present.');
        }

        $this->authToken = $data['AuthToken'];
    }

    private function createSession(Client $client)
    {
        // The "createsession" endpoint might also need an Accept header if it requires JSON response
        $response = $client->createRequest()
            ->setMethod('POST')
            ->setUrl($this->baseApiUrl . '/createsession')
            ->addHeaders([
                'x-authenticationToken' => $this->authToken,
                'Content-Type'          => 'application/json',
                'Accept'                => 'application/json', // often helps
            ])
            ->setFormat(Client::FORMAT_JSON)  // tells Yii2 to encode setData() as JSON
            ->setData([
                'Profile' => Yii::$app->params['ebsco']['edsProfile'],
                'Guest'   => 'n',
                'Org'     => '',
            ])
            // If this endpoint also expects some JSON data, pass it here, but often it's just an empty POST
            ->send();

        if (!$response->isOk) {
            throw new \Exception('Session creation failed: ' . $response->content);
        }

        $data = $response->getData();
        if (empty($data['SessionToken'])) {
            throw new \Exception('Invalid session response. No SessionToken present.');
        }

        $this->sessionToken = $data['SessionToken'];
    }

    private function performSearch(Client $client, array $queries, array $params = [], array $actionParams = [])
    {
        // Build request data by merging queries with params
        $requestData = array_merge($queries, [
            'resultsperpage' => $params['resultsperpage'] ?? 20,
            'pagenumber'     => $params['pagenumber'] ?? 1,
            'sort'           => $params['sort'] ?? 'relevance',
            'searchmode'     => $params['searchmode'] ?? 'all',
            'highlight'      => $params['highlight'] ?? 'y',
            'includefacets'  => $params['includefacets'] ?? 'n',
            'autosuggest'    => $params['autosuggest'] ?? 'n',
            'autocorrect'    => $params['autocorrect'] ?? 'n',
            'view'           => $params['view'] ?? 'detailed',
            'includeimagequickview' => $params['includeimagequickview'] ?? 'n',
        ]);
        
        // Merge action parameters (action, facetfilter, limiter, expander, relatedcontent)
        if (!empty($actionParams)) {
            $requestData = array_merge($requestData, $actionParams);
        }
        
        // A GET request for searching
        $response = $client->createRequest()
            ->setMethod('GET')
            ->setUrl($this->baseApiUrl . '/Search')
            ->addHeaders([
                'x-authenticationToken' => $this->authToken,
                'x-sessionToken'        => $this->sessionToken,
                'Accept'                => 'application/json',
                'Accept-Charset'        => 'utf-8',
            ])
            ->setData($requestData)
            ->send();

        if (!$response->isOk) {
            throw new \Exception('Search failed: ' . $response->content);
        }

        return $this->processFullSearchResults($response->content);
    }

    private function performRetrieve(Client $client, $dbId, $an)
    {
        $response = $client->createRequest()
            ->setMethod('GET')
            ->setUrl($this->baseApiUrl . '/Retrieve')
            ->addHeaders([
                'x-authenticationToken' => $this->authToken,
                'x-sessionToken'        => $this->sessionToken,
                'Accept'                => 'application/json',
            ])
            ->setData([
                'an'        => $an,           // Accession Number
                'dbid'      => $dbId,         // Database ID
                'highlight' => 'n',           // e.g. don't highlight search terms
                'view'      => 'detailed',    // or 'brief' or whichever
            ])
            ->send();

        if (!$response->isOk) {
            throw new \Exception('Retrieve failed: ' . $response->content);
        }

        // We can parse the JSON here or pass it to a separate parser
        return $this->processRetrieveResults($response->content);
    }

    private function performInfo(Client $client)
    {
        $response = $client->createRequest()
            ->setMethod('GET')
            ->setUrl($this->baseApiUrl . '/Info')
            ->addHeaders([
                'x-authenticationToken' => $this->authToken,
                'x-sessionToken'        => $this->sessionToken,
                'Accept'                => 'application/json',
            ])
            ->send();

        if (!$response->isOk) {
            throw new \Exception('Info request failed: ' . $response->content);
        }

        return $this->processInfoResults($response->content);
    }

    private function processInfoResults($content)
    {
        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Invalid JSON from Info endpoint.');
        }

        // Structure the info response
        $result = [];
        
        // Available search modes
        if (!empty($data['AvailableSearchModes'])) {
            $result['searchModes'] = [];
            foreach ($data['AvailableSearchModes'] as $mode) {
                $result['searchModes'][] = [
                    'Mode' => $mode['Mode'] ?? '',
                    'Label' => $mode['Label'] ?? '',
                    'DefaultOn' => $mode['DefaultOn'] ?? 'n'
                ];
            }
        }

        // Available sort options
        if (!empty($data['AvailableSorts'])) {
            $result['sortOptions'] = [];
            foreach ($data['AvailableSorts'] as $sort) {
                $result['sortOptions'][] = [
                    'Id' => $sort['Id'] ?? '',
                    'Label' => $sort['Label'] ?? '',
                    'AddAction' => $sort['AddAction'] ?? ''
                ];
            }
        }

        // Available expanders
        if (!empty($data['AvailableExpanders'])) {
            $result['expanders'] = [];
            foreach ($data['AvailableExpanders'] as $expander) {
                $result['expanders'][] = [
                    'Id' => $expander['Id'] ?? '',
                    'Label' => $expander['Label'] ?? '',
                    'DefaultOn' => $expander['DefaultOn'] ?? 'n',
                    'AddAction' => $expander['AddAction'] ?? ''
                ];
            }
        }

        // Available limiters
        if (!empty($data['AvailableLimiters'])) {
            $result['limiters'] = [];
            foreach ($data['AvailableLimiters'] as $limiter) {
                $limiterData = [
                    'Id' => $limiter['Id'] ?? '',
                    'Label' => $limiter['Label'] ?? '',
                    'Type' => $limiter['Type'] ?? '',
                    'DefaultOn' => $limiter['DefaultOn'] ?? 'n',
                    'AddAction' => $limiter['AddAction'] ?? ''
                ];
                // Include limiter values if available (for select-type limiters)
                if (!empty($limiter['LimiterValues'])) {
                    $limiterData['Values'] = [];
                    foreach ($limiter['LimiterValues'] as $val) {
                        $limiterData['Values'][] = [
                            'Value' => $val['Value'] ?? '',
                            'Action' => $val['Action'] ?? ''
                        ];
                    }
                }
                $result['limiters'][] = $limiterData;
            }
        }

        // Available related content options
        if (!empty($data['AvailableRelatedContent'])) {
            $result['relatedContent'] = [];
            foreach ($data['AvailableRelatedContent'] as $rc) {
                $result['relatedContent'][] = [
                    'Type' => $rc['Type'] ?? '',
                    'Label' => $rc['Label'] ?? '',
                    'DefaultOn' => $rc['DefaultOn'] ?? 'n',
                    'AddAction' => $rc['AddAction'] ?? ''
                ];
            }
        }

        // Available Did You Mean options (AutoSuggest, AutoCorrect)
        if (!empty($data['AvailableDidYouMeanOptions'])) {
            $result['didYouMeanOptions'] = [];
            foreach ($data['AvailableDidYouMeanOptions'] as $dym) {
                $result['didYouMeanOptions'][] = [
                    'Id' => $dym['Id'] ?? '',
                    'Label' => $dym['Label'] ?? '',
                    'DefaultOn' => $dym['DefaultOn'] ?? 'n'
                ];
            }
        }

        // Include Image Quick View option
        if (!empty($data['IncludeImageQuickView'])) {
            $result['imageQuickView'] = [];
            foreach ($data['IncludeImageQuickView'] as $iqv) {
                $result['imageQuickView'][] = [
                    'Label' => $iqv['Label'] ?? '',
                    'DefaultOn' => $iqv['DefaultOn'] ?? 'n',
                    'AddAction' => $iqv['AddAction'] ?? ''
                ];
            }
        }

        // View result settings
        if (!empty($data['ViewResultSettings'])) {
            $result['viewResultSettings'] = $data['ViewResultSettings'];
        }

        // Application settings
        if (!empty($data['ApplicationSettings'])) {
            $result['applicationSettings'] = [
                'SessionTimeout' => $data['ApplicationSettings']['SessionTimeout'] ?? 0,
                'ResultListSettings' => $data['ApplicationSettings']['ResultListSettings'] ?? ''
            ];
        }

        // API settings
        if (!empty($data['ApiSettings'])) {
            $result['apiSettings'] = $data['ApiSettings'];
        }

        return $result;
    }


    private function endSession(Client $client)
    {
        // This might also need headers like Accept: application/json
        $client->createRequest()
            ->setMethod('POST')
            ->setUrl($this->baseApiUrl . '/endsession')
            ->addHeaders([
                'x-sessionToken' => $this->sessionToken,
            ])
            ->send();
    }

    private function processFullSearchResults($content)
    {
        // 1) Decode the JSON
        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Invalid JSON provided to processFullSearchResults().');
        }

        // 2) Pull out top-level elements
        $searchRequest = $data['SearchRequestGet'] ?? [];
        $searchResult = $data['SearchResult'] ?? [];
        $statistics = $searchResult['Statistics'] ?? [];
        $dataObject = $searchResult['Data'] ?? [];
        $records = $dataObject['Records'] ?? [];
        $availableFacets = $searchResult['AvailableFacets'] ?? [];
        $availableCriteria = $searchResult['AvailableCriteria'] ?? [];
        $databases = $statistics['Databases'] ?? [];

        // 3) Parse queries with actions
        $queries = [];
        $searchCriteriaWithActions = $searchRequest['SearchCriteriaWithActions'] ?? [];
        if (!empty($searchCriteriaWithActions['QueriesWithAction'])) {
            foreach ($searchCriteriaWithActions['QueriesWithAction'] as $queryWithAction) {
                $queries[] = [
                    'query' => $queryWithAction['Query']['Term'] ?? '',
                    'removeAction' => $queryWithAction['RemoveAction'] ?? ''
                ];
            }
        }

        // 4) Parse applied facets with actions
        $appliedFacets = [];
        if (!empty($searchCriteriaWithActions['FacetFiltersWithAction'])) {
            foreach ($searchCriteriaWithActions['FacetFiltersWithAction'] as $facetFilter) {
                $facetValues = [];
                if (!empty($facetFilter['FacetValuesWithAction'])) {
                    foreach ($facetFilter['FacetValuesWithAction'] as $facetValueWithAction) {
                        $facetValues[] = [
                            'Id' => $facetValueWithAction['FacetValue']['Id'] ?? '',
                            'Value' => $facetValueWithAction['FacetValue']['Value'] ?? '',
                            'RemoveAction' => $facetValueWithAction['RemoveAction'] ?? ''
                        ];
                    }
                }
                $appliedFacets[] = [
                    'FilterId' => $facetFilter['FilterId'] ?? '',
                    'FacetValues' => $facetValues,
                    'RemoveAction' => $facetFilter['RemoveAction'] ?? ''
                ];
            }
        }

        // 5) Parse applied limiters with actions
        $appliedLimiters = [];
        if (!empty($searchCriteriaWithActions['LimitersWithAction'])) {
            foreach ($searchCriteriaWithActions['LimitersWithAction'] as $limiter) {
                $limiterValue = [
                    'Value' => $limiter['LimiterValuesWithAction']['LimiterValueWithAction']['Value'] ?? '',
                    'RemoveAction' => $limiter['LimiterValuesWithAction']['LimiterValueWithAction']['RemoveAction'] ?? ''
                ];
                $appliedLimiters[] = [
                    'Id' => $limiter['Id'] ?? '',
                    'LimiterValue' => $limiterValue,
                    'RemoveAction' => $limiter['RemoveAction'] ?? ''
                ];
            }
        }

        // 6) Parse applied expanders with actions
        $appliedExpanders = [];
        if (!empty($searchCriteriaWithActions['ExpandersWithAction'])) {
            foreach ($searchCriteriaWithActions['ExpandersWithAction'] as $expander) {
                $appliedExpanders[] = [
                    'Id' => $expander['Id'] ?? '',
                    'RemoveAction' => $expander['RemoveAction'] ?? ''
                ];
            }
        }

        // 7) Parse related content (RelatedRecords, RelatedPublications)
        $relatedRecords = [];
        $relatedContent = $searchResult['RelatedContent'] ?? [];
        if (!empty($relatedContent['RelatedRecords'])) {
            foreach ($relatedContent['RelatedRecords'] as $relRec) {
                if (($relRec['Type'] ?? '') === 'rs') {
                    $relRecords = [];
                    if (!empty($relRec['Records'])) {
                        foreach ($relRec['Records'] as $rec) {
                            $items = [];
                            if (!empty($rec['Items'])) {
                                foreach ($rec['Items'] as $item) {
                                    $items[] = [
                                        'Name' => $item['Name'] ?? '',
                                        'Label' => $item['Label'] ?? '',
                                        'Group' => $item['Group'] ?? '',
                                        'Data' => $item['Data'] ?? ''
                                    ];
                                }
                            }
                            $relRecords[] = [
                                'ResultId' => $rec['ResultId'] ?? '',
                                'DbId' => $rec['Header']['DbId'] ?? '',
                                'DbLabel' => $rec['Header']['DbLabel'] ?? '',
                                'An' => $rec['Header']['An'] ?? '',
                                'PLink' => $rec['PLink'] ?? '',
                                'ImageInfo' => $rec['ImageInfo']['CoverArt']['Target'] ?? '',
                                'FullText' => $rec['FullText'] ?? '',
                                'Items' => $items
                            ];
                        }
                    }
                    $relatedRecords[] = [
                        'Type' => 'rs',
                        'Label' => $relRec['Label'] ?? '',
                        'Records' => $relRecords
                    ];
                }
            }
        }

        // 8) Parse auto-suggested and auto-corrected terms
        $autoSuggestedTerms = [];
        if (!empty($searchResult['AutoSuggestedTerms'])) {
            foreach ($searchResult['AutoSuggestedTerms'] as $term) {
                $autoSuggestedTerms[] = is_array($term) ? ($term['Term'] ?? '') : $term;
            }
        }

        $autoCorrectedTerms = [];
        if (!empty($searchResult['AutoCorrectedTerms'])) {
            foreach ($searchResult['AutoCorrectedTerms'] as $term) {
                $autoCorrectedTerms[] = is_array($term) ? ($term['Term'] ?? '') : $term;
            }
        }

        // 9) Parse date range from available criteria
        $dateRange = [];
        if (!empty($availableCriteria['DateRange'])) {
            $min = $availableCriteria['DateRange']['MinDate'] ?? '';
            $max = $availableCriteria['DateRange']['MaxDate'] ?? '';
            $currentYear = date('Y');
            
            // If min is lower than 1000, set to 1000-01
            if (!empty($min) && (int)substr($min, 0, 4) < 1000) {
                $min = '1000-01';
            }
            // If max is more than two years in future, cap it
            if (!empty($max) && (int)substr($max, 0, 4) > ($currentYear + 2)) {
                $max = ($currentYear + 2) . '-12';
            }
            $dateRange = [
                'MinDate' => $min,
                'MaxDate' => $max
            ];
        }

        // 10) Parse records
        $parsedRecords = [];
        foreach ($records as $record) {
            $parsedRecords[] = $this->parseRecord($record);
        }

        // 11) Parse facets
        $parsedFacets = [];
        foreach ($availableFacets as $facet) {
            $parsedFacets[] = $this->parseFacet($facet);
        }

        // 12) Return everything in a structured array
        return [
            'request' => [
                'QueryString' => $searchRequest['QueryString'] ?? '',
                'SearchCriteriaWithActions' => $searchCriteriaWithActions
            ],
            'statistics' => [
                'TotalHits' => $statistics['TotalHits'] ?? 0,
                'TotalSearchTime' => $statistics['TotalSearchTime'] ?? 0,
                'Databases' => $databases,
            ],
            'queries' => $queries,
            'appliedFacets' => $appliedFacets,
            'appliedLimiters' => $appliedLimiters,
            'appliedExpanders' => $appliedExpanders,
            'relatedRecords' => $relatedRecords,
            'autoSuggest' => $autoSuggestedTerms,
            'autoCorrect' => $autoCorrectedTerms,
            'dateRange' => $dateRange,
            'recordFormat' => $dataObject['RecordFormat'] ?? '',
            'records' => $parsedRecords,
            'facets' => $parsedFacets,
            'availableCriteria' => $availableCriteria
        ];
    }

    private function processRetrieveResults($json)
    {
        $data = json_decode($json, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Invalid JSON from Retrieve endpoint.');
        }

        // The top-level object usually has "Record"
        $record = $data['Record'] ?? null;
        if (!$record) {
            throw new \Exception('No Record found in Retrieve response.');
        }

        // Use parseRecord method to structure it
        $parsedRecord = $this->parseRecord($record);

        return [
            'record' => $parsedRecord
        ];
    }

    /**
     * Parse an individual record from EBSCO - matches original buildRecords structure
     */
    private function parseRecord(array $record)
    {
        $result = [];
        $header = $record['Header'] ?? [];

        // Header fields - match original field names exactly
        $result['AccessLevel'] = $header['AccessLevel'] ?? '';
        $result['pubType'] = $header['PubType'] ?? '';
        $result['PubTypeId'] = $header['PubTypeId'] ?? '';
        $result['ResultId'] = $record['ResultId'] ?? '';
        $result['DbId'] = $header['DbId'] ?? '';
        $result['DbLabel'] = $header['DbLabel'] ?? '';
        $result['An'] = $header['An'] ?? '';
        $result['PLink'] = $record['PLink'] ?? '';

        // FullText information
        $fullTextObj = $record['FullText'] ?? [];

        // PDF - get the link type from FullText->Links->Link->Type
        $result['PDF'] = '';
        if (!empty($fullTextObj['Links'])) {
            if (isset($fullTextObj['Links'][0])) {
                $result['PDF'] = $fullTextObj['Links'][0]['Type'] ?? '';
            } elseif (isset($fullTextObj['Links']['Link'])) {
                $result['PDF'] = $fullTextObj['Links']['Link']['Type'] ?? '';
            }
        }

        // HTML availability from FullText->Text->Availability
        $result['HTML'] = $fullTextObj['Text']['Availability'] ?? '';

        // FullText raw value
        $result['FullText'] = $fullTextObj['Text']['Value'] ?? ($fullTextObj['Text']['Availability'] ?? '');

        // Image info (cover art) - keyed by size like original
        $result['ImageInfo'] = '';
        if (!empty($record['ImageInfo']['CoverArt'])) {
            $result['ImageInfo'] = [];
            foreach ($record['ImageInfo']['CoverArt'] as $image) {
                $size = $image['Size'] ?? '';
                $target = $image['Target'] ?? '';
                if ($size) {
                    $result['ImageInfo'][$size] = $target;
                }
            }
        }

        // CustomLinks at record level
        if (!empty($record['CustomLinks'])) {
            $result['CustomLinks'] = [];
            foreach ($record['CustomLinks'] as $customLink) {
                $result['CustomLinks'][] = [
                    'Category' => $customLink['Category'] ?? '',
                    'Icon' => $customLink['Icon'] ?? '',
                    'MouseOverText' => $customLink['MouseOverText'] ?? '',
                    'Name' => $customLink['Name'] ?? '',
                    'Text' => $customLink['Text'] ?? '',
                    'Url' => $customLink['Url'] ?? ''
                ];
            }
        }

        // FullTextCustomLinks (inside FullText object)
        if (!empty($fullTextObj['CustomLinks'])) {
            $result['FullTextCustomLinks'] = [];
            foreach ($fullTextObj['CustomLinks'] as $customLink) {
                $result['FullTextCustomLinks'][] = [
                    'Category' => $customLink['Category'] ?? '',
                    'Icon' => $customLink['Icon'] ?? '',
                    'MouseOverText' => $customLink['MouseOverText'] ?? '',
                    'Name' => $customLink['Name'] ?? '',
                    'Text' => $customLink['Text'] ?? '',
                    'Url' => $customLink['Url'] ?? ''
                ];
            }
        }

        // Items array - grouped by Group like original: $result['Items'][$group][]
        if (!empty($record['Items'])) {
            $result['Items'] = [];
            foreach ($record['Items'] as $item) {
                $label = $item['Label'] ?? '';
                $group = $item['Group'] ?? '';
                $data = $item['Data'] ?? '';

                // Process HTML data using toHTML
                $processedData = $this->toHTML($data, $group);
                
                // Clean data - extract plain text values
                $cleanData = $this->cleanItemData($data, $group);

                $result['Items'][$group][] = [
                    'Label' => $label,
                    'Group' => $group,
                    'Data' => $processedData,
                    'CleanData' => $cleanData
                ];
            }
        }

        // RecordInfo - parse BibEntity and BibRelationships matching original structure
        if (!empty($record['RecordInfo'])) {
            $result['RecordInfo'] = [];
            $result['RecordInfo']['BibEntity'] = [
                'Identifiers' => [],
                'Languages' => [],
                'PhysicalDescription' => [],
                'Subjects' => [],
                'Titles' => []
            ];

            $bibRecord = $record['RecordInfo']['BibRecord'] ?? [];
            $bibEntity = $bibRecord['BibEntity'] ?? [];

            // Identifiers
            if (!empty($bibEntity['Identifiers'])) {
                foreach ($bibEntity['Identifiers'] as $identifier) {
                    $result['RecordInfo']['BibEntity']['Identifiers'][] = [
                        'Type' => $identifier['Type'] ?? '',
                        'Value' => $identifier['Value'] ?? ''
                    ];
                }
            }

            // Languages
            if (!empty($bibEntity['Languages'])) {
                foreach ($bibEntity['Languages'] as $language) {
                    $result['RecordInfo']['BibEntity']['Languages'][] = [
                        'Code' => $language['Code'] ?? '',
                        'Text' => $language['Text'] ?? ''
                    ];
                }
            }

            // Physical Description (pagination) - match original key names
            if (!empty($bibEntity['PhysicalDescription']['Pagination'])) {
                $result['RecordInfo']['BibEntity']['PhysicalDescription']['Pagination'] =
                    $bibEntity['PhysicalDescription']['Pagination']['PageCount'] ?? '';
                $result['RecordInfo']['BibEntity']['PhysicalDescription']['StartPage'] =
                    $bibEntity['PhysicalDescription']['Pagination']['StartPage'] ?? '';
            }

            // Subjects
            if (!empty($bibEntity['Subjects'])) {
                foreach ($bibEntity['Subjects'] as $subject) {
                    $result['RecordInfo']['BibEntity']['Subjects'][] = [
                        'SubjectFull' => $subject['SubjectFull'] ?? '',
                        'Type' => $subject['Type'] ?? ''
                    ];
                }
            }

            // Titles
            if (!empty($bibEntity['Titles'])) {
                foreach ($bibEntity['Titles'] as $title) {
                    $result['RecordInfo']['BibEntity']['Titles'][] = [
                        'TitleFull' => $title['TitleFull'] ?? '',
                        'Type' => $title['Type'] ?? ''
                    ];
                }
            }

            // BibRelationships
            $result['RecordInfo']['BibRelationships'] = [
                'HasContributorRelationships' => [],
                'IsPartOfRelationships' => []
            ];

            $bibRelationships = $bibRecord['BibRelationships'] ?? [];

            // Contributors
            if (!empty($bibRelationships['HasContributorRelationships'])) {
                foreach ($bibRelationships['HasContributorRelationships'] as $contributor) {
                    $nameFull = $contributor['PersonEntity']['Name']['NameFull'] ?? '';
                    if ($nameFull) {
                        $result['RecordInfo']['BibRelationships']['HasContributorRelationships'][] = [
                            'NameFull' => $nameFull
                        ];
                    }
                }
            }

            // IsPartOf relationships (journal info, dates, etc.)
            if (!empty($bibRelationships['IsPartOfRelationships'])) {
                foreach ($bibRelationships['IsPartOfRelationships'] as $relationship) {
                    $relEntity = $relationship['BibEntity'] ?? [];

                    // Dates - use 'date' key like original
                    if (!empty($relEntity['Dates'])) {
                        foreach ($relEntity['Dates'] as $date) {
                            $result['RecordInfo']['BibRelationships']['IsPartOfRelationships']['date'][] = [
                                'D' => $date['D'] ?? '',
                                'M' => $date['M'] ?? '',
                                'Type' => $date['Type'] ?? '',
                                'Y' => $date['Y'] ?? ''
                            ];
                        }
                    }

                    // Identifiers (ISSN, etc.)
                    if (!empty($relEntity['Identifiers'])) {
                        foreach ($relEntity['Identifiers'] as $identifier) {
                            $result['RecordInfo']['BibRelationships']['IsPartOfRelationships']['Identifiers'][] = [
                                'Type' => $identifier['Type'] ?? '',
                                'Value' => $identifier['Value'] ?? ''
                            ];
                        }
                    }

                    // Titles (Journal title, etc.)
                    if (!empty($relEntity['Titles'])) {
                        foreach ($relEntity['Titles'] as $title) {
                            $result['RecordInfo']['BibRelationships']['IsPartOfRelationships']['Titles'][] = [
                                'TitleFull' => $title['TitleFull'] ?? '',
                                'Type' => $title['Type'] ?? ''
                            ];
                        }
                    }

                    // Numbering (volume, issue) - use 'numbering' key like original
                    if (!empty($relEntity['Numbering'])) {
                        foreach ($relEntity['Numbering'] as $number) {
                            $result['RecordInfo']['BibRelationships']['IsPartOfRelationships']['numbering'][] = [
                                'Type' => $number['Type'] ?? '',
                                'Value' => $number['Value'] ?? ''
                            ];
                        }
                    }
                }
            }
        }

        // ImageQuickView items
        if (!empty($record['ImageQuickViewItems'])) {
            $result['ImageQuickView'] = [];
            foreach ($record['ImageQuickViewItems'] as $iqv) {
                $result['ImageQuickView'][] = [
                    'DbId' => $iqv['DbId'] ?? '',
                    'An' => $iqv['An'] ?? '',
                    'Type' => $iqv['Type'] ?? '',
                    'Url' => $iqv['Url'] ?? ''
                ];
            }
        }

        // Holdings
        if (!empty($record['Holdings'])) {
            $result['Holdings'] = $record['Holdings'];
        }

        return $result;
    }

    /**
     * Helper to parse an individual facet object from "AvailableFacets"
     */
    private function parseFacet(array $facet)
    {
        $facetValues = $facet['AvailableFacetValues'] ?? [];
        $parsedValues = [];
        foreach ($facetValues as $val) {
            $parsedValues[] = [
                'Value' => $val['Value'] ?? '',
                'Count' => $val['Count'] ?? 0,
                'AddAction' => $val['AddAction'] ?? '',
            ];
        }

        return [
            'Id' => $facet['Id'] ?? '',
            'Label' => $facet['Label'] ?? '',
            'Values' => $parsedValues
        ];
    }

    /**
     * Convert EBSCO XML-style data to HTML - matches original toHTML function
     */
    private function toHTML($data, $group = '')
    {
        $allowed_searchlink_groups = ['Au', 'Su'];
        $allowed_link_groups = ['URL'];

        $xml_to_html_tags = [
            '<jsection' => '<section',
            '</jsection' => '</section',
            '<highlight' => '<span class="highlight"',
            '<highligh' => '<span class="highlight"',
            '</highlight>' => '</span>',
            '</highligh' => '</span>',
            '<text' => '<div',
            '</text' => '</div',
            '<title' => '<h2',
            '</title' => '</h2',
            '<anid' => '<p',
            '</anid' => '</p',
            '<aug' => '<strong',
            '</aug' => '</strong',
            '<hd' => '<h3',
            '</hd' => '</h3',
            '<linebr' => '<br',
            '</linebr' => '',
            '<olist' => '<ol',
            '</olist' => '</ol',
            '<reflink' => '<a',
            '</reflink' => '</a',
            '<blist' => '<p class="blist"',
            '</blist' => '</p',
            '<bibl' => '<a',
            '</bibl' => '</a',
            '<bibtext' => '<span',
            '</bibtext' => '</span',
            '<ref' => '<div class="ref"',
            '</ref' => '</div',
            '<ulink' => '<a',
            '</ulink' => '</a',
            '<superscript' => '<sup',
            '</superscript' => '</sup',
            '<relatesTo' => '<sup',
            '</relatesTo' => '</sup',
            '<script' => '',
            '</script' => '',
            '<i>' => '',
            '</i>' => ''
        ];

        $xml_to_search_types = [
            'Au' => 'Author',
            'Su' => 'Subject'
        ];

        $data = html_entity_decode($data);

        if (!empty($data)) {
            $search = array_keys($xml_to_html_tags);
            $replace = array_values($xml_to_html_tags);
            $data = str_replace($search, $replace, $data);

            $data = preg_replace('/<\/highlight/', '</span>', $data);
            $data = preg_replace('/<\/span>>/', '</span>', $data);
            $data = preg_replace('/<\/searchLink/', '</searchLink>', $data);
            $data = preg_replace('/<\/searchLink>>/', '</searchLink>', $data);

            if (!empty($group) && in_array($group, $allowed_searchlink_groups)) {
                $link_xml = '/<searchLink fieldCode="([^"]*)" term="([^"]*)">/';
                $link_html = "<a href=\"results.php?query=$2&fieldcode=$1\">";
                $data = preg_replace($link_xml, $link_html, $data);
                $data = str_replace('</searchLink>', '</a>', $data);
                $data = str_replace('<br />', '; ', $data);
                $data = str_replace('*', '', $data);
            }

            if (!empty($group) && in_array($group, $allowed_link_groups)) {
                $link_xml = '/<link linkTarget="([^"]*)" linkTerm="([^"]*)" linkWindow="([^"]*)">/';
                $link_html = "<a name=\"$1\" href=\"$2\" target=\"$3\">";
                $data = preg_replace($link_xml, $link_html, $data);
                $data = str_replace('</link>', '</a>', $data);
            }

            $link_xml = '/<searchLink fieldCode="([^\"]*)" term="%22([^\"]*)%22">/';
            $link_html = '<span>';
            $data = preg_replace($link_xml, $link_html, $data);
            $data = str_replace('</searchLink>', '</span>', $data);

            $data = preg_replace('/<a idref="([^\"]*)"/', '<a href="#$1"', $data);
            $data = preg_replace('/<a id="([^\"]*)" idref="([^\"]*)" type="([^\"]*)"/', '<a id="$1" href="#$2"', $data);
        }

        return $data;
    }

    /**
     * Clean item data by extracting plain text values from HTML
     * Returns clean structured data depending on the group type
     */
    private function cleanItemData($data, $group = '')
    {
        // Decode HTML entities first
        $data = html_entity_decode($data);
        
        // For URL groups, extract just the URL
        // Raw EBSCO data uses <link linkTerm="URL"> format, not <a href="">
        if ($group === 'URL') {
            // First try raw EBSCO format: <link linkTerm="http://...">
            if (preg_match('/linkTerm\s*=\s*["\']([^"\']+)["\']/i', $data, $matches)) {
                return $matches[1];
            }
            // Fallback: try standard href format (in case data is already processed)
            if (preg_match('/href\s*=\s*["\']([^"\']+)["\']/i', $data, $matches)) {
                return $matches[1];
            }
            // If no link found, strip tags and return
            return trim(strip_tags($data));
        }
        
        // For Author (Au) groups, extract author names as an array
        // Raw EBSCO data uses <searchLink term="AuthorName"> format
        if ($group === 'Au') {
            $authors = [];
            // First try raw EBSCO format: <searchLink ... term="AuthorName">
            if (preg_match_all('/term\s*=\s*["\']([^"\']+)["\']/i', $data, $matches)) {
                foreach ($matches[1] as $match) {
                    $name = trim(urldecode($match));
                    // Remove surrounding %22 (encoded quotes) if present
                    $name = trim($name, '%22');
                    if (!empty($name)) {
                        $authors[] = $name;
                    }
                }
            }
            // If we found authors, return them
            if (!empty($authors)) {
                return $authors;
            }
            // Fallback: try matching text content between > and </
            if (preg_match_all('/>([^<]+)<\/(?:a|searchLink|span)>/i', $data, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $match) {
                    $name = trim($match[1]);
                    if (!empty($name)) {
                        $authors[] = $name;
                    }
                }
            }
            if (!empty($authors)) {
                return $authors;
            }
            // Final fallback: strip all tags and split by semicolon
            $plain = trim(strip_tags($data));
            if (strpos($plain, ';') !== false) {
                return array_map('trim', explode(';', $plain));
            }
            return $plain;
        }
        
        // For Subject (Su) groups, extract subjects as an array
        // Raw EBSCO data uses <searchLink term="SubjectName"> format
        if ($group === 'Su') {
            $subjects = [];
            // First try raw EBSCO format: <searchLink ... term="SubjectName">
            if (preg_match_all('/term\s*=\s*["\']([^"\']+)["\']/i', $data, $matches)) {
                foreach ($matches[1] as $match) {
                    $subject = trim(urldecode($match));
                    // Remove surrounding %22 (encoded quotes) if present
                    $subject = trim($subject, '%22');
                    if (!empty($subject)) {
                        $subjects[] = $subject;
                    }
                }
            }
            // If we found subjects, return them
            if (!empty($subjects)) {
                return $subjects;
            }
            // Fallback: try matching text content between > and </
            if (preg_match_all('/>([^<]+)<\/(?:a|searchLink|span)>/i', $data, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $match) {
                    $subject = trim($match[1]);
                    if (!empty($subject)) {
                        $subjects[] = $subject;
                    }
                }
            }
            if (!empty($subjects)) {
                return $subjects;
            }
            // Final fallback: strip all tags and split by semicolon
            $plain = trim(strip_tags($data));
            if (strpos($plain, ';') !== false) {
                return array_map('trim', explode(';', $plain));
            }
            return $plain;
        }
        
        // For SrcInfo or other groups that may have semicolon-separated URLs or values
        if ($group === 'SrcInfo') {
            $clean = trim(strip_tags($data));
            // If contains semicolons, split into array
            if (strpos($clean, ';') !== false) {
                return array_map('trim', explode(';', $clean));
            }
            return $clean;
        }
        
        // For all other groups, just strip HTML tags and clean up
        $clean = strip_tags($data);
        // Clean up multiple spaces and trim
        $clean = preg_replace('/\s+/', ' ', $clean);
        $clean = trim($clean);
        
        return $clean;
    }

    private function formatResponse($data)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        return [
            'status' => 'success',
            'code' => 200,
            'data' => $data,
        ];
    }
}
