<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/lib/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='GET'){header('Allow: GET');json_response(['error'=>'Methode nicht erlaubt.'],405);}
$abholung='Abholung in 08468 Reichenbach im Vogtland';$kaution='Kaution 100 € – wird bei Rückgabe erstattet';
$ausstattung=['15 Gläser in verschiedenen Größen (5 groß, 6 mittel, 4 klein)','2 dekorative Holzkisten zur Präsentation, für eine schöne Höhenstaffelung','Servierzangen','weiteres passendes Zubehör für einen stimmigen Gesamtlook'];
$defaults=[
'basic'=>['name'=>'Basic','priceCents'=>8900,'description'=>'Das Basic-Paket enthält nur die Candybar selbst, ganz ohne weiteres Zubehör.','includes'=>['Die Candybar selbst',$abholung,$kaution],'note'=>"Gläser, Deko-Kisten, Servierzangen und Süßigkeitenfüllung sind im Basic-Paket nicht enthalten. Diese gibt es optional im Comfort- bzw. Rundum-Sorglos-Paket dazu.",'images'=>[]],
'comfort'=>['name'=>'Comfort','priceCents'=>12900,'description'=>'Im Comfort-Paket ist unsere Candybar mit folgender Ausstattung enthalten:','includes'=>array_merge($ausstattung,[$abholung,$kaution]),'note'=>"Die Süßigkeitenfüllung ist im Comfort-Paket nicht enthalten. Diese gibt es optional im Rundum-Sorglos-Paket dazu.",'images'=>[]],
'rundumsorglos'=>['name'=>'Rundum sorglos','priceCents'=>22900,'description'=>'Das Rundum-Sorglos-Paket enthält alles aus dem Comfort-Paket, plus die komplette Süßigkeitenfüllung – ihr müsst euch um nichts mehr kümmern.','includes'=>array_merge($ausstattung,['vollständige Süßigkeitenfüllung für alle Gläser, abgestimmt auf die jeweilige Glasgröße'],$abholung,$kaution),'extrasTitle'=>'Süßigkeitenfüllung (ca. 5,8 kg gesamt)','extras'=>['Erdnüsse – 500 g','Pistazien – 375 g','Kinder Schoko-Bons – 400 g','Zetti Knusper Flocken – 810 g','Schoko & Keks Sticks – 180 g','Hitschies Original Mix – 420 g','Haribo Happy-Cola – 350 g','Haribo Primavera Erdbeeren – 350 g','Haribo Fruity-Fruits – 480 g','Rainbow Pixel – 320 g','Katjes Wunderland sauer – 420 g','Marshmallows – 300 g','Popcorn karamellisiert – 200 g','Paprika Chips – 400 g','Linsen Chips – 270 g'],'note'=>'Reicht für ca. 60–70 Gäste.','images'=>[]]
];
try{
 $saved=db()->query("SELECT package_id,data_json FROM packages")->fetchAll();
 foreach($saved as $row){$v=json_decode($row['data_json'],true);if(is_array($v)&&isset($defaults[$row['package_id']]))$defaults[$row['package_id']]=array_merge($defaults[$row['package_id']],$v);}
 $out=[];
 foreach($defaults as $id=>$p){
  $price=(int)($p['priceCents']??0);$images=is_array($p['images']??null)?array_values(array_filter($p['images'],fn($u)=>is_string($u)&&filter_var($u,FILTER_VALIDATE_URL)&&str_starts_with($u,'https://'))):[];
  $out[]=['id'=>$id,'name'=>clean_text($p['name']??'',80),'priceCents'=>$price,'price'=>number_format($price/100,2,',','.').' €','description'=>clean_text($p['description']??'',2000),'includes'=>array_values(array_filter($p['includes']??[], 'is_string')),'extrasTitle'=>clean_text($p['extrasTitle']??'',120),'extras'=>array_values(array_filter($p['extras']??[], 'is_string')),'note'=>clean_text($p['note']??'',2000),'images'=>$images];
 }
 json_response(['packages'=>$out]);
}catch(Throwable $e){error_log('Packages API: '.$e->getMessage());json_response(['error'=>'Pakete momentan nicht verfügbar.'],503);}
