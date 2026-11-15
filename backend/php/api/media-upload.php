<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/lib/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='POST'){header('Allow: POST');json_response(['error'=>'Methode nicht erlaubt.'],405);}
if(session_status()!==PHP_SESSION_ACTIVE){
 session_name('candybar_admin');
 session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','httponly'=>true,'samesite'=>'Strict']);
 session_start();
}
if(empty($_SESSION['admin_id']))json_response(['error'=>'Bitte melde dich erneut an.'],401);
$token=(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'');
if($token===''||!hash_equals((string)($_SESSION['csrf']??''),$token))json_response(['error'=>'Sicherheitsprüfung fehlgeschlagen.'],403);
if(!isset($_FILES['image'])||!is_uploaded_file($_FILES['image']['tmp_name']))json_response(['error'=>'Bitte wähle ein Bild aus.'],400);
$file=$_FILES['image'];
if(($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK)json_response(['error'=>'Upload fehlgeschlagen.'],400);
if((int)$file['size']>5*1024*1024)json_response(['error'=>'Das Bild darf maximal 5 MB groß sein.'],413);
$info=@getimagesize($file['tmp_name']);
if(!is_array($info))json_response(['error'=>'Die Bilddatei ist ungültig.'],415);
$mime=(string)($info['mime']??'');
$extensions=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
if(!isset($extensions[$mime])||!class_exists('finfo'))json_response(['error'=>'Nur JPG-, PNG- und WebP-Bilder sind erlaubt.'],415);
$finfo=new finfo(FILEINFO_MIME_TYPE);
if($finfo->file($file['tmp_name'])!==$mime)json_response(['error'=>'Die Bilddatei ist ungültig.'],415);
if(($info[0]??0)>6000||($info[1]??0)>6000)json_response(['error'=>'Das Bild ist zu groß aufgelöst.'],413);
$root=dirname(__DIR__,3);$dir=$root.'/uploads/candybar';
if(!is_dir($dir)&&!mkdir($dir,0755,true)&&!is_dir($dir))json_response(['error'=>'Upload-Ordner konnte nicht erstellt werden.'],503);
$name=bin2hex(random_bytes(16)).'.'.$extensions[$mime];$target=$dir.'/'.$name;
if(!move_uploaded_file($file['tmp_name'],$target))json_response(['error'=>'Bild konnte nicht gespeichert werden.'],503);
json_response(['ok'=>true,'url'=>'/uploads/candybar/'.$name],201);
