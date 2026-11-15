<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/bootstrap.php';

function admin_session(): void {
 if(session_status()===PHP_SESSION_ACTIVE)return;
 session_name('candybar_admin');
 session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','httponly'=>true,'samesite'=>'Strict']);
 session_start();
}
function admin_user(): array {
 admin_session();
 if(empty($_SESSION['admin_id']))json_response(['error'=>'Bitte melde dich erneut an.'],401);
 return ['id'=>(int)$_SESSION['admin_id'],'csrf'=>(string)$_SESSION['csrf']];
}
function admin_post(): array {
 $u=admin_user();$token=(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'');
 if($token===''||!hash_equals($u['csrf'],$token))json_response(['error'=>'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden.'],403);
 return $u;
}
function default_packages(): array {
 return [
 'basic'=>['name'=>'Basic','priceCents'=>8900,'description'=>'Das Basic-Paket enthält nur die Candybar selbst, ganz ohne weiteres Zubehör.','includes'=>['Die Candybar selbst','Abholung in 08468 Reichenbach im Vogtland','Kaution 100 € – wird bei Rückgabe erstattet'],'note'=>'Gläser, Deko-Kisten, Servierzangen und Süßigkeitenfüllung sind nicht enthalten.','images'=>[]],
 'comfort'=>['name'=>'Comfort','priceCents'=>12900,'description'=>'Im Comfort-Paket ist unsere Candybar mit folgender Ausstattung enthalten:','includes'=>['15 Gläser in verschiedenen Größen (5 groß, 6 mittel, 4 klein)','2 dekorative Holzkisten','Servierzangen','weiteres passendes Zubehör','Abholung in 08468 Reichenbach im Vogtland','Kaution 100 € – wird bei Rückgabe erstattet'],'note'=>'Süßigkeitenfüllung ist nicht enthalten.','images'=>[]],
 'rundumsorglos'=>['name'=>'Rundum sorglos','priceCents'=>22900,'description'=>'Das Rundum-Sorglos-Paket enthält alles aus dem Comfort-Paket plus Süßigkeitenfüllung.','includes'=>['15 Gläser in verschiedenen Größen','2 dekorative Holzkisten','Servierzangen','weiteres passendes Zubehör','vollständige Süßigkeitenfüllung','Abholung in 08468 Reichenbach im Vogtland','Kaution 100 € – wird bei Rückgabe erstattet'],'extrasTitle'=>'Süßigkeitenfüllung (ca. 5,8 kg gesamt)','extras'=>['Erdnüsse – 500 g','Pistazien – 375 g','Kinder Schoko-Bons – 400 g','Zetti Knusper Flocken – 810 g','Schoko & Keks Sticks – 180 g','Hitschies Original Mix – 420 g','Haribo Happy-Cola – 350 g','Haribo Primavera Erdbeeren – 350 g','Haribo Fruity-Fruits – 480 g','Rainbow Pixel – 320 g','Katjes Wunderland sauer – 420 g','Marshmallows – 300 g','Popcorn karamellisiert – 200 g','Paprika Chips – 400 g','Linsen Chips – 270 g'],'note'=>'Reicht für ca. 60–70 Gäste.','images'=>[]]
 ];
}
if($_SERVER['REQUEST_METHOD']==='GET'){
 $action=(string)($_GET['action']??'me');
 if($action==='me'){admin_session();json_response(['authenticated'=>!empty($_SESSION['admin_id']),'csrf'=>$_SESSION['csrf']??null]);}
 admin_user();
 if($action!=='dashboard')json_response(['error'=>'Unbekannte Aktion.'],404);
 $pdo=db();
 $bookings=$pdo->query("SELECT id,name,email,phone,location,message,package_name,event_start,event_end,event_days,pickup_date,return_date,price_cents,booking_status,payment_status,paid_amount_cents,created_at FROM bookings ORDER BY created_at DESC")->fetchAll();
 $contacts=$pdo->query("SELECT id,name,email,address,subject,message,created_at FROM contacts ORDER BY created_at DESC LIMIT 200")->fetchAll();
 $packages=default_packages();
 foreach($pdo->query("SELECT package_id,data_json FROM packages")->fetchAll() as $r){$v=json_decode($r['data_json'],true);if(is_array($v))$packages[$r['package_id']]=$v;}
 $settings=[];foreach($pdo->query("SELECT setting_key,setting_value FROM site_settings")->fetchAll() as $r)$settings[$r['setting_key']]=$r['setting_value'];
 json_response(['bookings'=>$bookings,'contacts'=>$contacts,'packages'=>$packages,'settings'=>$settings]);
}
if($_SERVER['REQUEST_METHOD']!=='POST'){header('Allow: GET, POST');json_response(['error'=>'Methode nicht erlaubt.'],405);}
$d=request_json();$action=(string)($d['action']??'');
if($action==='login'){
 admin_session();$email=strtolower(clean_text($d['email']??'',254));$pw=is_string($d['password']??null)?$d['password']:'';
 if(!filter_var($email,FILTER_VALIDATE_EMAIL)||$pw==='')json_response(['error'=>'E-Mail oder Passwort stimmt nicht.'],400);
 $pdo=db();$hash=hash('sha256',$email);
 $q=$pdo->prepare("SELECT COUNT(*) FROM login_attempts WHERE email_hash=:h AND attempted_at>=UTC_TIMESTAMP()-INTERVAL 15 MINUTE");$q->execute([':h'=>$hash]);
 if((int)$q->fetchColumn()>=8)json_response(['error'=>'Zu viele Versuche. Bitte warte 15 Minuten.'],429);
 $q=$pdo->prepare("SELECT id,email,password_hash FROM admin_users WHERE email=:e AND active=1 LIMIT 1");$q->execute([':e'=>$email]);$u=$q->fetch();
 $pdo->prepare("INSERT INTO login_attempts(email_hash,attempted_at) VALUES(:h,UTC_TIMESTAMP())")->execute([':h'=>$hash]);
 if(!$u||!password_verify($pw,$u['password_hash']))json_response(['error'=>'E-Mail oder Passwort stimmt nicht.'],401);
 session_regenerate_id(true);$_SESSION['admin_id']=(int)$u['id'];$_SESSION['csrf']=bin2hex(random_bytes(32));
 $pdo->prepare("DELETE FROM login_attempts WHERE email_hash=:h")->execute([':h'=>$hash]);
 json_response(['ok'=>true,'csrf'=>$_SESSION['csrf']]);
}
if($action==='logout'){admin_session();$_SESSION=[];session_destroy();json_response(['ok'=>true]);}
admin_post();$pdo=db();
if($action==='booking_update'){
 $id=clean_text($d['id']??'',32);$s=clean_text($d['bookingStatus']??'',20);$p=clean_text($d['paymentStatus']??'',20);
 if(!preg_match('/^[a-f0-9]{32}$/',$id)||!in_array($s,['neu','bestätigt','abgelehnt'],true)||!in_array($p,['offen','bezahlt','fehlgeschlagen','erstattet'],true))json_response(['error'=>'Ungültige Angaben.'],400);
 $q=$pdo->prepare("SELECT price_cents FROM bookings WHERE id=:id");$q->execute([':id'=>$id]);$row=$q->fetch();if(!$row)json_response(['error'=>'Buchung nicht gefunden.'],404);
 $paid=$p==='bezahlt'?(int)$row['price_cents']:0;
 $q=$pdo->prepare("UPDATE bookings SET booking_status=:s,payment_status=:p,paid_amount_cents=:a,updated_at=UTC_TIMESTAMP() WHERE id=:id");$q->execute([':s'=>$s,':p'=>$p,':a'=>$paid,':id'=>$id]);json_response(['ok'=>true]);
}
if($action==='package_save'){
 $id=clean_text($d['id']??'',32);$p=$d['package']??null;
 if(!in_array($id,['basic','comfort','rundumsorglos'],true)||!is_array($p))json_response(['error'=>'Ungültiges Paket.'],400);
 $name=clean_text($p['name']??'',80);$price=(int)($p['priceCents']??0);
 if($name===''||$price<0||$price>10000000)json_response(['error'=>'Name oder Preis ungültig.'],400);
 $out=['name'=>$name,'priceCents'=>$price,'description'=>clean_text($p['description']??'',2000),'includes'=>array_slice(array_map(fn($v)=>clean_text($v,300),is_array($p['includes']??null)?$p['includes']:[]),0,40),'note'=>clean_text($p['note']??'',2000),'images'=>[]];
 $q=$pdo->prepare("INSERT INTO packages(package_id,data_json,updated_at) VALUES(:i,:j,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),updated_at=UTC_TIMESTAMP()");$q->execute([':i'=>$id,':j'=>json_encode($out,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);json_response(['ok'=>true]);
}
if($action==='setting_save'){
 $key=clean_text($d['key']??'',40);$value=clean_text($d['value']??'',12000);
 if(!in_array($key,['heroText','impressum','agb','datenschutz'],true))json_response(['error'=>'Ungültige Einstellung.'],400);
 $q=$pdo->prepare("INSERT INTO site_settings(setting_key,setting_value,updated_at) VALUES(:k,:v,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_at=UTC_TIMESTAMP()");$q->execute([':k'=>$key,':v'=>$value]);json_response(['ok'=>true]);
}
json_response(['error'=>'Unbekannte Aktion.'],404);
