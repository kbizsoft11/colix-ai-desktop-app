<?php
declare(strict_types=1);

// Store this file outside the public web root when possible. Otherwise replace
// the placeholder and restrict direct access to this file at the server level.
$aiApiKey = getenv('QWEN_API_KEY') ?: 'REPLACE_WITH_AI_API_KEY';
$aiEndpoint = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://extensions.kbizsoft.com');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['success' => false, 'message' => 'POST required.']);
if ($aiApiKey === 'REPLACE_WITH_AI_API_KEY') respond(500, ['success' => false, 'message' => 'The AI service is not configured.']);

$input = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($input)) respond(400, ['success' => false, 'message' => 'Invalid JSON request.']);

$subject = trim((string)($input['subject'] ?? ''));
$body = trim((string)($input['body'] ?? ''));
$instruction = trim((string)($input['instruction'] ?? ''));
if ($body === '') respond(400, ['success' => false, 'message' => 'The email body is empty.']);
if (strlen($subject) > 1000 || strlen($body) > 100000 || strlen($instruction) > 2000) respond(413, ['success' => false, 'message' => 'The draft is too large.']);

$prompt = "Improve this Outlook email. Correct grammar and spelling, make the wording professional, clear, and natural, while preserving the original meaning. Return ONLY valid JSON with exactly two string fields: subject and body. The body field must contain safe HTML suitable for Outlook, using only p, br, strong, em, u, ul, ol, and li tags. Do not include markdown fences or commentary.\n\nSubject:\n{$subject}\n\nBody HTML:\n{$body}";
if ($instruction !== '') $prompt .= "\n\nAdditional instruction:\n{$instruction}";

$request = json_encode([
    'model' => 'qwen3.5-flash',
    'messages' => [['role' => 'user', 'content' => $prompt]],
    'stream' => false,
    'enable_thinking' => false,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

$curl = curl_init($aiEndpoint);
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 45,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $aiApiKey, 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => $request,
]);
$raw = curl_exec($curl);
$curlError = curl_error($curl);
$httpCode = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);
if ($raw === false) respond(502, ['success' => false, 'message' => 'Unable to contact the AI service: ' . $curlError]);

$aiResponse = json_decode($raw, true);
if ($httpCode < 200 || $httpCode >= 300 || !is_array($aiResponse)) respond(502, ['success' => false, 'message' => 'The AI service returned an invalid response.']);
$content = $aiResponse['choices'][0]['message']['content'] ?? '';
if (!is_string($content) || trim($content) === '') respond(502, ['success' => false, 'message' => 'The AI service returned no improved email.']);

$content = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim($content));
$improved = json_decode($content, true);
if (!is_array($improved)) {
    $jsonStart = strpos($content, '{');
    $jsonEnd = strrpos($content, '}');
    if ($jsonStart !== false && $jsonEnd !== false && $jsonEnd > $jsonStart) {
        $improved = json_decode(substr($content, $jsonStart, $jsonEnd - $jsonStart + 1), true);
    }
}

// If the model returns plain text instead of the requested JSON wrapper, keep
// the rewrite usable rather than showing a format error to the user.
if (!is_array($improved) || !is_string($improved['body'] ?? null)) {
    $improved = ['subject' => $subject, 'body' => $content];
}
if (!is_string($improved['subject'] ?? null)) $improved['subject'] = $subject;

respond(200, ['success' => true, 'subject' => trim($improved['subject']), 'body' => $improved['body']]);
