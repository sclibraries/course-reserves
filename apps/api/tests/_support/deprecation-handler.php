<?php

if (!defined('CX037_DEPRECATION_GUARD_ACTIVE')) {
    define('CX037_DEPRECATION_GUARD_ACTIVE', true);
    error_reporting(E_ALL);

    set_error_handler(function ($severity, $message, $file, $line) {
        if (($severity & (E_DEPRECATED | E_USER_DEPRECATED)) !== 0) {
            throw new ErrorException($message, 0, $severity, $file, $line);
        }

        return false;
    });
}
