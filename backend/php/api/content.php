<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/lib/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='GET'){header('Allow: GET');json_response(['error'=>'Methode nicht erlaubt.'],405);}
try{
 $allowed=['heroText','heroImage','galleryImages','impressum','agb','datenschutz'];
 $q=db()->query("SELECT setting_key,setting_value FROM site_settings");$settings=[];
 foreach($q->fetchAll() as $r)if(in_array($r['setting_key'],$allowed,true))$settings[$r['setting_key']]=$r['setting_value'];
  $isPublicImage=static function($url):bool {
  if(!is_string($url)||$url==='')return false;
  if(preg_match('#^/uploads/candybar/[a-f0-9]{32}\\.(?:jpg|png|webp)$#D',$url)===1)return true;
  return filter_var($url,FILTER_VALIDATE_URL)!==false&&str_starts_with($url,'https://');
 };
 if(isset($settings['galleryImages'])){$decoded=json_decode($settings['galleryImages'],true);$settings['galleryImages']=is_array($decoded)?array_values(array_filter($decoded,$isPublicImage)):[];}
 if(isset($settings['heroImage'])&&!$isPublicImage($settings['heroImage']))unset($settings['heroImage']);
 json_response(['settings'=>$settings]);
}catch(Throwable $e){error_log('Public content API: '.$e->getMessage());json_response(['error'=>'Inhalte momentan nicht verfügbar.'],503);}
