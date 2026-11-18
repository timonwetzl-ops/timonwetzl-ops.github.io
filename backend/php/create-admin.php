<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/lib/bootstrap.php';
$email=strtolower(trim($argv[1]??''));
if(!filter_var($email,FILTER_VALIDATE_EMAIL)){fwrite(STDERR,"Aufruf: php create-admin.php admin@example.com\n");exit(1);}
fwrite(STDOUT,"Admin-Passwort eingeben (mindestens 12 Zeichen): ");
if(strncasecmp(PHP_OS,'WIN',3)===0){$password=trim((string)fgets(STDIN));}
else{system('stty -echo');$password=trim((string)fgets(STDIN));system('stty echo');fwrite(STDOUT,"\n");}
if(strlen($password)<12){fwrite(STDERR,"Mindestens 12 Zeichen erforderlich.\n");exit(1);}
$hash=password_hash($password,PASSWORD_DEFAULT);
$q=db()->prepare("INSERT INTO admin_users(email,password_hash,active) VALUES(:e,:p,1) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),active=1");
$q->execute([':e'=>$email,':p'=>$hash]);
fwrite(STDOUT,"Admin-Konto eingerichtet: ".$email."\n");
