// エントリーポイント：データ（data）・3D（scene）・画面（ui）をつなぐだけ。各層の責務は docs/ARCHITECTURE.md。
import './styles.css';
import { sampleMuseum } from './data/sampleMuseum';
import { createRoomScene } from './scene/room';
import { createViewer } from './scene/viewer';
import { attachPreviewControls } from './scene/previewControls';
import { mountShell } from './ui/shell';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('app not found');

const museum = sampleMuseum;
const { scene, camera, lights } = createRoomScene(museum);

const shell = mountShell(app, {
  featured: museum.exhibits.find((e) => e.title),
  initialLight: 60,
  onLightChange: (v) => {
    lights.ambient.intensity = (v / 100) * 1.5;
  },
});

let updateControls = () => {};
const viewer = createViewer(shell.viewport, scene, camera, () => updateControls());
updateControls = attachPreviewControls(viewer.canvas, camera);
