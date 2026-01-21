<?php
// upload_id_images.php
// Handles upload of ID Image (Front) and ID Image (Back) to ID_img folder

$targetDir = __DIR__ . '/ID_img/';
$response = ["success" => false, "front" => null, "back" => null, "error" => null];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!file_exists($targetDir)) {
        mkdir($targetDir, 0777, true);
    }
    $frontName = null;
    $backName = null;
    if (isset($_FILES['customerIdImageFront']) && $_FILES['customerIdImageFront']['error'] === UPLOAD_ERR_OK) {
        $frontName = uniqid('front_') . '_' . basename($_FILES['customerIdImageFront']['name']);
        $frontPath = $targetDir . $frontName;
        if (move_uploaded_file($_FILES['customerIdImageFront']['tmp_name'], $frontPath)) {
            $response['front'] = 'ID_img/' . $frontName;
        } else {
            $response['error'] = 'Failed to upload front image.';
        }
    }
    if (isset($_FILES['customerIdImageBack']) && $_FILES['customerIdImageBack']['error'] === UPLOAD_ERR_OK) {
        $backName = uniqid('back_') . '_' . basename($_FILES['customerIdImageBack']['name']);
        $backPath = $targetDir . $backName;
        if (move_uploaded_file($_FILES['customerIdImageBack']['tmp_name'], $backPath)) {
            $response['back'] = 'ID_img/' . $backName;
        } else {
            $response['error'] = 'Failed to upload back image.';
        }
    }
    if ($response['front'] || $response['back']) {
        $response['success'] = true;
    }
}
header('Content-Type: application/json');
echo json_encode($response);
