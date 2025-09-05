import * as THREE from 'three';

// Simple OrbitControls implementation
export class OrbitControls {
  public target: THREE.Vector3;
  public enableDamping: boolean = true;
  public dampingFactor: number = 0.05;
  public screenSpacePanning: boolean = false;
  public minDistance: number = 0;
  public maxDistance: number = Infinity;
  public maxPolarAngle: number = Math.PI;

  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private spherical: THREE.Spherical;
  private sphericalDelta: THREE.Spherical;
  private scale: number = 1;
  private panOffset: THREE.Vector3;
  private zoomChanged: boolean = false;

  private rotateStart: THREE.Vector2;
  private rotateEnd: THREE.Vector2;
  private rotateDelta: THREE.Vector2;

  private panStart: THREE.Vector2;
  private panEnd: THREE.Vector2;
  private panDelta: THREE.Vector2;

  private dollyStart: THREE.Vector2;
  private dollyEnd: THREE.Vector2;
  private dollyDelta: THREE.Vector2;

  private state: number = 0; // NONE = 0, ROTATE = 1, DOLLY = 2, PAN = 3

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3();
    
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();
    this.panOffset = new THREE.Vector3();

    this.rotateStart = new THREE.Vector2();
    this.rotateEnd = new THREE.Vector2();
    this.rotateDelta = new THREE.Vector2();

    this.panStart = new THREE.Vector2();
    this.panEnd = new THREE.Vector2();
    this.panDelta = new THREE.Vector2();

    this.dollyStart = new THREE.Vector2();
    this.dollyEnd = new THREE.Vector2();
    this.dollyDelta = new THREE.Vector2();

    this.addEventListeners();
    this.update();
  }

  public update(): boolean {
    const offset = new THREE.Vector3();
    const quat = new THREE.Quaternion().setFromUnitVectors(this.camera.up, new THREE.Vector3(0, 1, 0));
    const quatInverse = quat.clone().invert();

    const lastPosition = new THREE.Vector3();
    const lastQuaternion = new THREE.Quaternion();

    const position = this.camera.position;

    offset.copy(position).sub(this.target);
    offset.applyQuaternion(quat);

    this.spherical.setFromVector3(offset);

    if (this.enableDamping) {
      this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor;
      this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor;
    } else {
      this.spherical.theta += this.sphericalDelta.theta;
      this.spherical.phi += this.sphericalDelta.phi;
    }

    this.spherical.phi = Math.max(0.000001, Math.min(this.maxPolarAngle, this.spherical.phi));
    this.spherical.makeSafe();

    this.spherical.radius *= this.scale;
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));

    if (this.enableDamping) {
      this.target.addScaledVector(this.panOffset, this.dampingFactor);
    } else {
      this.target.add(this.panOffset);
    }

    offset.setFromSpherical(this.spherical);
    offset.applyQuaternion(quatInverse);

    position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);

    if (this.enableDamping) {
      this.sphericalDelta.theta *= (1 - this.dampingFactor);
      this.sphericalDelta.phi *= (1 - this.dampingFactor);
      this.panOffset.multiplyScalar(1 - this.dampingFactor);
    } else {
      this.sphericalDelta.set(0, 0, 0);
      this.panOffset.set(0, 0, 0);
    }

    this.scale = 1;

    if (this.zoomChanged ||
        lastPosition.distanceToSquared(this.camera.position) > 0.000001 ||
        8 * (1 - lastQuaternion.dot(this.camera.quaternion)) > 0.000001) {
      
      lastPosition.copy(this.camera.position);
      lastQuaternion.copy(this.camera.quaternion);
      this.zoomChanged = false;
      
      return true;
    }

    return false;
  }

  public dispose(): void {
    this.removeEventListeners();
  }

  private addEventListeners(): void {
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this));
    this.domElement.addEventListener('contextmenu', this.onContextMenu.bind(this));
  }

  private removeEventListeners(): void {
    this.domElement.removeEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.removeEventListener('wheel', this.onMouseWheel.bind(this));
    this.domElement.removeEventListener('contextmenu', this.onContextMenu.bind(this));
  }

  private onMouseDown(event: MouseEvent): void {
    event.preventDefault();

    switch (event.button) {
      case 0: // LEFT
        this.state = 1; // ROTATE
        this.rotateStart.set(event.clientX, event.clientY);
        break;
      case 1: // MIDDLE
        this.state = 2; // DOLLY
        this.dollyStart.set(event.clientX, event.clientY);
        break;
      case 2: // RIGHT
        this.state = 3; // PAN
        this.panStart.set(event.clientX, event.clientY);
        break;
    }

    if (this.state !== 0) {
      document.addEventListener('mousemove', this.onMouseMove.bind(this));
      document.addEventListener('mouseup', this.onMouseUp.bind(this));
    }
  }

  private onMouseMove(event: MouseEvent): void {
    event.preventDefault();

    switch (this.state) {
      case 1: // ROTATE
        this.rotateEnd.set(event.clientX, event.clientY);
        this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(0.5);

        this.sphericalDelta.theta -= 2 * Math.PI * this.rotateDelta.x / this.domElement.clientHeight;
        this.sphericalDelta.phi -= 2 * Math.PI * this.rotateDelta.y / this.domElement.clientHeight;

        this.rotateStart.copy(this.rotateEnd);
        break;

      case 2: // DOLLY
        this.dollyEnd.set(event.clientX, event.clientY);
        this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);

        if (this.dollyDelta.y > 0) {
          this.scale /= 0.95;
        } else if (this.dollyDelta.y < 0) {
          this.scale *= 0.95;
        }

        this.dollyStart.copy(this.dollyEnd);
        break;

      case 3: // PAN
        this.panEnd.set(event.clientX, event.clientY);
        this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(0.5);

        const element = this.domElement;
        const offset = new THREE.Vector3();
        const position = this.camera.position;
        offset.copy(position).sub(this.target);
        let targetDistance = offset.length();

        targetDistance *= Math.tan((this.camera as THREE.PerspectiveCamera).fov / 2 * Math.PI / 180.0);

        const panX = 2 * this.panDelta.x * targetDistance / element.clientHeight;
        const panY = 2 * this.panDelta.y * targetDistance / element.clientHeight;

        const v = new THREE.Vector3();
        v.setFromMatrixColumn(this.camera.matrix, 0);
        v.multiplyScalar(-panX);
        this.panOffset.add(v);

        v.setFromMatrixColumn(this.camera.matrix, 1);
        v.multiplyScalar(panY);
        this.panOffset.add(v);

        this.panStart.copy(this.panEnd);
        break;
    }

    this.update();
  }

  private onMouseUp(): void {
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('mouseup', this.onMouseUp.bind(this));
    this.state = 0;
  }

  private onMouseWheel(event: WheelEvent): void {
    event.preventDefault();

    if (event.deltaY < 0) {
      this.scale *= 0.95;
    } else if (event.deltaY > 0) {
      this.scale /= 0.95;
    }

    this.update();
    this.zoomChanged = true;
  }

  private onContextMenu(event: Event): void {
    event.preventDefault();
  }
}
