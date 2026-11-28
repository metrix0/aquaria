import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSkyView, skyCamera, skyInterfaceOpacity, SKY_PAN_SECONDS } from '../src/sky-camera.js';
test('camera pans upward without mutating gameplay coordinates and reverses exactly', () => {
  const camera = { x: 330, y: 0, width: 640, height: 380 };
  let progress = 0;
  let lastY = camera.y;
  for (let i=0;i<12;i++) {
    progress = advanceSkyView(progress,true,SKY_PAN_SECONDS/12);
    const view = skyCamera(camera,progress);
    assert.equal(view.x,camera.x);
    assert.ok(view.y <= lastY);
    lastY = view.y;
  }
  progress = advanceSkyView(progress,true,.01);
  assert.equal(progress,1);
  assert.equal(skyInterfaceOpacity(progress),1);
  assert.equal(skyInterfaceOpacity(.4),0);
  assert.equal(camera.y,0);
  assert.ok(lastY < -300);
  for (let i=0;i<13;i++) progress=advanceSkyView(progress,false,SKY_PAN_SECONDS/12);
  assert.equal(progress,0);
  assert.equal(skyCamera(camera,progress),camera);
  assert.equal(advanceSkyView(0,true,0,true),1);
  assert.equal(advanceSkyView(1,false,0,true),0);
});
