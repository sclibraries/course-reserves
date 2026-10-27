<?php

namespace app\services;

use app\models\StaffNavPin;
use app\models\StaffNavPinDefault;
use app\models\User;

/** Reads and persists staff navigation choices and institution defaults. */
class NavPinService
{
    use ServiceResult;

    private const DEFAULT_PINS = ['my-work', 'submissions'];

    public function getUserPins($username)
    {
        $user = $this->findUser($username);
        if (!$user) {
            return $this->result(404, ['error' => 'user_not_found']);
        }

        $saved = StaffNavPin::findOne((int)$user->id);
        $defaults = $this->defaultPins();
        return $this->result(200, [
            'pins' => $saved ? $saved->pins : $defaults,
            'is_default' => $saved === null,
            'defaults' => $defaults,
        ]);
    }

    public function saveUserPins($username, $pins)
    {
        if (!$this->validPins($pins)) {
            return $this->invalidPins();
        }
        $user = $this->findUser($username);
        if (!$user) {
            return $this->result(404, ['error' => 'user_not_found']);
        }

        $record = StaffNavPin::findOne((int)$user->id) ?: new StaffNavPin();
        $record->user_id = (int)$user->id;
        $record->pins = $pins;
        $record->updated_at = date('Y-m-d H:i:s');
        $record->save(false);
        return $this->getUserPins($username);
    }

    public function resetUserPins($username)
    {
        $user = $this->findUser($username);
        if (!$user) {
            return $this->result(404, ['error' => 'user_not_found']);
        }
        StaffNavPin::deleteAll(['user_id' => (int)$user->id]);
        return $this->getUserPins($username);
    }

    public function getDefaults()
    {
        return $this->result(200, ['pins' => $this->defaultPins()]);
    }

    public function saveDefaults($username, $pins)
    {
        if (!$this->validPins($pins)) {
            return $this->invalidPins();
        }
        $user = $this->findUser($username);
        if (!$user) {
            return $this->result(404, ['error' => 'user_not_found']);
        }

        $record = StaffNavPinDefault::findOne(1) ?: new StaffNavPinDefault();
        $record->id = 1;
        $record->pins = $pins;
        $record->updated_by = (int)$user->id;
        $record->updated_at = date('Y-m-d H:i:s');
        $record->save(false);
        return $this->getDefaults();
    }

    private function findUser($username)
    {
        return User::findByUsername($username);
    }

    private function defaultPins()
    {
        $record = StaffNavPinDefault::findOne(1);
        return $record ? $record->pins : self::DEFAULT_PINS;
    }

    private function validPins($pins)
    {
        if (!is_array($pins) || count($pins) > 10) {
            return false;
        }
        if ($pins && array_keys($pins) !== range(0, count($pins) - 1)) {
            return false;
        }

        $seen = [];
        foreach ($pins as $pin) {
            if (!is_string($pin) || preg_match('/^[a-z0-9-]{1,40}$/', $pin) !== 1 || isset($seen[$pin])) {
                return false;
            }
            $seen[$pin] = true;
        }
        return true;
    }

    private function invalidPins()
    {
        return $this->result(422, ['error' => 'invalid_pins', 'message' => 'Invalid pins.']);
    }
}
