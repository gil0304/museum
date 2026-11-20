export type ExhibitType = 'image'|'text'|'video'|'audio'|'glb'|'interactive-html';
export interface MuseumDocument { schemaVersion: 1; id: string; title: string; objects: Array<{id:string; type:string; position:[number,number,number]}>; exhibits: Array<{id:string; type:ExhibitType; position:[number,number,number]; assetId?:string}> }
