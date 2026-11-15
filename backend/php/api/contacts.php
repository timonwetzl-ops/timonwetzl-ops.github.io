<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/lib/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='POST'){header('Allow: POST');json_response(['error'=>'Methode nicht erlaubt.'],405);}
$d=request_json();
if(clean_text($d['website']??'',200)!=='')json_response(['ok'=>true],202);
$name=clean_text($d['name']??'',120);$email=clean_text($d['email']??'',254);
$address=clean_text($d['address']??'',240);$subject=clean_text($d['subject']??'',180);$message=clean_text($d['message']??'',4000);
if($name===''||!filter_var($email,FILTER_VALIDATE_EMAIL)||$message==='')json_response(['error'=>'Bitte prüfe deine Angaben.'],400);
try{$q=db()->prepare("INSERT INTO contacts(name,email,address,subject,message,created_at) VALUES(:n,:e,:a,:s,:m,UTC_TIMESTAMP())");$q->execute([':n'=>$name,':e'=>$email,':a'=>$address,':s'=>$subject,':m'=>$message]);json_response(['ok'=>true],201);}
catch(Throwable $e){error_log('Contact endpoint: '.$e->getMessage());json_response(['error'=>'Nachricht konnte nicht gesendet werden.'],503);}
