import * as THREE from 'three';
export function createDemoRoom(){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#d6d5d1');
 const camera=new THREE.PerspectiveCamera(54,1,.1,100);camera.position.set(0,2.4,8);
 const lights={ambient:new THREE.HemisphereLight(0xffffff,0x8b7968,1.0)};scene.add(lights.ambient);
 const key=new THREE.DirectionalLight(0xffefdb,2.2);key.position.set(-3,8,4);scene.add(key);
 const mat=(c:string)=>new THREE.MeshStandardMaterial({color:c,roughness:0.9});
 function box(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);scene.add(mesh);return mesh}
 const white=mat('#eeebe5');box(9,.2,7,0,-.1,0,mat('#b9b2a8'));box(9,4,.2,0,2,-3.5,white);box(.2,4,7,-4.5,2,0,mat('#f4f0e9'));box(.2,4,7,4.5,2,0,white);
 const frame=mat('#262c30'); const art=mat('#517e87');box(2.3,1.8,.09,-2,2,-3.32,frame);box(2.05,1.54,.1,-2,2,-3.24,art);
 box(1.8,1.5,.09,1.35,2.1,-3.32,frame);box(1.54,1.24,.1,1.35,2.1,-3.23,mat('#d3a575'));
 box(1.15,.85,1.15,2.65,.42,.7,white);
 const sculpture=new THREE.Mesh(new THREE.TorusKnotGeometry(.37,.13,84,10),new THREE.MeshStandardMaterial({color:'#9a8273',metalness:.25,roughness:.4}));sculpture.position.set(2.65,1.28,.7);scene.add(sculpture);
 return {scene,camera,lights};
}
