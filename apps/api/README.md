# Course Reserves API

## Production web server

Serve only `web/` and `admin/` through a DocumentRoot or Alias; all other paths, including `vendor/` and `runtime/`, must be unreachable.
Set `ServerTokens Prod` and `expose_php = Off`.
Set `session.upload_progress.enabled = 0`.
Set `YII_DEBUG` off and `YII_ENV` to `prod`.
Rotate application secrets at cutover.
The API root, `web/`, and `admin/` `.htaccess` files provide a second line of defence.
