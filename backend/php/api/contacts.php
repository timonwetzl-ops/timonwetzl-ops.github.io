<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/lib/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='POST'){header('Allow: POST');json_response(['error'=>'Methode nicht erlaubt.'],405);}
$d=request_json();
if(clean_text($d['website']??'',200)!=='')json_response(['ok'=>true],202);
$name=clean_text($d['name']??'',120);$email=clean_text($d['email']??'',254);
$address=clean_text($d['address']??'',240);$subject=clean_text($d['subject']??'',180);$message=clean_text($d['message']??'',4000);
if($name===''||!filter_var($email,FILTER_VALIDATE_EMAIL)||$message==='')json_response(['error'=>'Bitte prüfe deine Angaben.'],400);
try{
 $config=app_config();$secret=(string)($config['security']['rate_limit_secret']??'');
 if(strlen($secret)<32||$secret==='CHANGE_TO_A_LONG_RANDOM_SECRET')json_response(['error'=>'Das Kontaktformular ist noch nicht vollständig konfiguriert.'],503);
 $pdo=db();$ip=(string)($_SERVER['REMOTE_ADDR']??'unknown');$ipHash=hash_hmac('sha256',$ip,$secret);
 $pdo->exec("DELETE FROM contact_attempts WHERE attempted_at<UTC_TIMESTAMP()-INTERVAL 2 DAY");
 $limit=$pdo->prepare("SELECT COUNT(*) FROM contact_attempts WHERE ip_hash=:ip AND attempted_at>=UTC_TIMESTAMP()-INTERVAL 1 HOUR");
 $limit->execute([':ip'=>$ipHash]);
 if((int)$limit->fetchColumn()>=5)json_response(['error'=>'Zu viele Nachrichten. Bitte versuche es später erneut.'],429);
 $pdo->prepare("INSERT INTO contact_attempts(ip_hash,attempted_at) VALUES(:ip,UTC_TIMESTAMP())")->execute([':ip'=>$ipHash]);
 $q=$pdo->prepare("INSERT INTO contacts(name,email,address,subject,message,created_at) VALUES(:n,:e,:a,:s,:m,UTC_TIMESTAMP())");$q->execute([':n'=>$name,':e'=>$email,':a'=>$address,':s'=>$subject,':m'=>$message]);json_response(['ok'=>true],201);
 }
catch(Throwable $e){error_log('Contact endpoint: '.$e->getMessage());json_response(['error'=>'Nachricht konnte nicht gesendet werden.'],503);}
