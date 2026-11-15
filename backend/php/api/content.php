<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/lib/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='GET'){header('Allow: GET');json_response(['error'=>'Methode nicht erlaubt.'],405);}
try{
 $allowed=['heroText','heroImage','impressum','agb','datenschutz'];
 $q=db()->query("SELECT setting_key,setting_value FROM site_settings");$settings=[];
 foreach($q->fetchAll() as $r)if(in_array($r['setting_key'],$allowed,true))$settings[$r['setting_key']]=$r['setting_value'];
 if(isset($settings['heroImage'])&&(!filter_var($settings['heroImage'],FILTER_VALIDATE_URL)||!str_starts_with($settings['heroImage'],'https://')))unset($settings['heroImage']);
 json_response(['settings'=>$settings]);
}catch(Throwable $e){error_log('Public content API: '.$e->getMessage());json_response(['error'=>'Inhalte momentan nicht verfügbar.'],503);}
