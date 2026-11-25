<?php
declare(strict_types=1);

const UPSTREAM_ORIGIN = 'https://api.46.250.238.167.nip.io';
const MAX_PROXY_BODY_BYTES = 8 * 1024 * 1024;

function failProxy(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['message' => $message], JSON_UNESCAPED_SLASHES);
    exit;
}

$requestUri = $_SERVER['REQUEST_URI'] ?? '/api';
if (strpos($requestUri, '/api') !== 0) {
    failProxy(400, 'Invalid API path');
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if (!in_array($method, ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], true)) {
    failProxy(405, 'Method not allowed');
}

$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > MAX_PROXY_BODY_BYTES) {
    failProxy(413, 'Request body is too large');
}

$upstreamUrl = UPSTREAM_ORIGIN . $requestUri;
$incomingHeaders = function_exists('getallheaders') ? getallheaders() : [];
$forwardHeaders = [];
$excludedHeaders = [
    'accept-encoding' => true,
    'connection' => true,
    'content-length' => true,
    'host' => true,
    'transfer-encoding' => true,
    'x-forwarded-for' => true,
    'x-forwarded-host' => true,
    'x-forwarded-proto' => true,
];
$contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
$isMultipart = strpos($contentType, 'multipart/form-data') === 0;
$rebuildMultipartBody = $isMultipart && $method === 'POST';

foreach ($incomingHeaders as $name => $value) {
    $lowerName = strtolower((string) $name);
    if (isset($excludedHeaders[$lowerName])) {
        continue;
    }
    if ($rebuildMultipartBody && $lowerName === 'content-type') {
        continue;
    }
    $forwardHeaders[] = $name . ': ' . $value;
}

$remoteAddress = $_SERVER['REMOTE_ADDR'] ?? '';
if ($remoteAddress !== '') {
    $forwardHeaders[] = 'X-Forwarded-For: ' . $remoteAddress;
}
$forwardHeaders[] = 'X-Forwarded-Host: jrc.pens.ac.id';
$forwardHeaders[] = 'X-Forwarded-Proto: https';

$requestBody = null;
if (!in_array($method, ['GET', 'HEAD'], true)) {
    if ($rebuildMultipartBody) {
        $requestBody = $_POST;
        foreach ($_FILES as $field => $upload) {
            if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                failProxy(400, 'Invalid multipart upload');
            }
            $requestBody[$field] = new CURLFile(
                (string) $upload['tmp_name'],
                (string) ($upload['type'] ?? 'application/octet-stream'),
                (string) ($upload['name'] ?? 'upload.bin'),
            );
        }
    } else {
        $requestBody = file_get_contents('php://input');
        if ($requestBody === false) {
            failProxy(400, 'Unable to read request body');
        }
    }
}

$responseHeaders = [];
$curl = curl_init($upstreamUrl);
if ($curl === false) {
    failProxy(502, 'API relay unavailable');
}

curl_setopt_array($curl, [
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_HEADER => false,
    CURLOPT_HTTPHEADER => $forwardHeaders,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_TIMEOUT => 120,
    CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$responseHeaders): int {
        $length = strlen($line);
        $trimmed = trim($line);
        if ($trimmed === '') {
            return $length;
        }
        if (strpos($trimmed, 'HTTP/') === 0) {
            $responseHeaders = [];
            return $length;
        }
        $separator = strpos($line, ':');
        if ($separator !== false) {
            $name = strtolower(trim(substr($line, 0, $separator)));
            $value = trim(substr($line, $separator + 1));
            $responseHeaders[$name][] = $value;
        }
        return $length;
    },
]);

if ($requestBody !== null) {
    curl_setopt($curl, CURLOPT_POSTFIELDS, $requestBody);
}
if ($method === 'HEAD') {
    curl_setopt($curl, CURLOPT_NOBODY, true);
}

$responseBody = curl_exec($curl);
if ($responseBody === false) {
    curl_close($curl);
    failProxy(502, 'API relay failed');
}
$status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
curl_close($curl);

http_response_code($status > 0 ? $status : 502);
$allowedResponseHeaders = [
    'cache-control' => true,
    'content-disposition' => true,
    'content-type' => true,
    'etag' => true,
    'last-modified' => true,
    'location' => true,
    'set-cookie' => true,
    'x-request-id' => true,
];
foreach ($responseHeaders as $name => $values) {
    if (!isset($allowedResponseHeaders[$name])) {
        continue;
    }
    foreach ($values as $value) {
        header($name . ': ' . $value, $name !== 'set-cookie');
    }
}

echo $responseBody;
