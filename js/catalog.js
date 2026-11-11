/* Katalog jenjang dan mata pelajaran, dapat dikembangkan sesuai kebutuhan sekolah. */
(function(root){'use strict';
const SUBJECTS={
SD:['PAI & Budi Pekerti','Pendidikan Pancasila','Bahasa Indonesia','Matematika','IPAS','Bahasa Inggris','PJOK','Seni Budaya'],
SMP:['PAI & Budi Pekerti','Pendidikan Pancasila','Bahasa Indonesia','Matematika','IPA','IPS','Bahasa Inggris','Informatika','PJOK','Seni Budaya'],
SMA:['PAI & Budi Pekerti','Pendidikan Pancasila','Bahasa Indonesia','Matematika','Bahasa Inggris','Biologi','Fisika','Kimia','Sejarah','Geografi','Ekonomi','Sosiologi','Informatika','PJOK','Seni Budaya','Prakarya dan Kewirausahaan'],
Umum:[]};
const GRADES={SD:[1,2,3,4,5,6],SMP:[7,8,9],SMA:[10,11,12],Umum:[]};
root.SLCatalog=Object.freeze({SUBJECTS,GRADES,LEVELS:['SD','SMP','SMA','Umum']});
})(typeof window!=='undefined'?window:globalThis);
