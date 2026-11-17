import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.124.0/build/three.module.js";
// global scene values
var btn, gl, glCanvas, camera, scene, renderer;
var controller, reticle;

// global xr value
var xrSession = null;
var xrViewerPose;
var hitTestSource = null;
var hitTestSourceRequested = false;

loadScene();

function loadScene() {
        // setup WebGL
        glCanvas = document.createElement('canvas');
        gl = glCanvas.getContext('webgl', { antialias: true });

        // setup Three.js scene
        camera = new THREE.PerspectiveCamera(
                70,
                window.innerWidth / window.innerHeight,
                0.01,
                1000
        );

        scene = new THREE.Scene();
        // add hemisphere light
        var light = new THREE.HemisphereLight( 0xffffff, 0xbbbbff, 1 );
        light.position.set( 0.5, 1, 0.25 );
        scene.add( light );


        // setup Three.js WebGL renderer
        renderer = new THREE.WebGLRenderer({
                canvas: glCanvas,
                context: gl
        });
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );
        renderer.xr.enabled = true;
        document.body.appendChild( renderer.domElement );

        var geometry = new THREE.CylinderBufferGeometry(0.1, 0.1, 0.2, 32).translate(0, 0.1, 0);
        
        // controller click event listener
function onSelect() {
    if (!reticle.visible) return;                console.log("on select fired...");
                var material = new THREE.MeshPhongMaterial( { color: 0xffffff * Math.random() } );
                var mesh = new THREE.Mesh(geometry, material);
                mesh.applyMatrix4(reticle.matrix); // THIS IS A KEY FUNCTION
                mesh.scale.y = Math.random() * 2 + 1; // double value of random number then add 1 for height, why?
                scene.add(mesh);
        }

        // get controller WebXR Device API through Three.js
        controller = renderer.xr.getController(0);
        controller.addEventListener('select', onSelect);
        scene.add(controller);

        // reticle and reticle properties
        reticle =   new THREE.Mesh(
                new THREE.RingBufferGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
                new THREE.MeshBasicMaterial({color: "#00FF00"})
        );

        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);
        
        // begin xr query
        navigator.xr.isSessionSupported('immersive-ar')
                .then((supported) => {
                  if (supported) {
                        btn = document.createElement("button");
                        btn.addEventListener('click', onRequestSession);
                        btn.innerHTML = "Enter XR";
                        var header = document.querySelector("header");
                        header.appendChild(btn);
                }
                  else {
                        navigator.xr.isSessionSupported('inline')
                        .then((supported) => {
                                if (supported) {
                                console.log('inline session supported')
                                }
                                else {console.log('inline not supported')};
                        })
                  }
                })
                .catch((reason) => {
                        console.log('WebXR not supported: ' + reason);
                });
}

// request immersive-ar session with hit-test
function onRequestSession() {
    console.log("requesting session");
    navigator.xr.requestSession('immersive-ar', {requiredFeatures: ['hit-test'], optionalFeatures: ['local-floor']})
        .then(onSessionStarted)
        .catch((reason) => {
            console.log('request disabled: ' + reason);
        });
}

function onSessionStarted(session) {
    console.log('starting session');
    btn.removeEventListener('click', onRequestSession);
    btn.addEventListener('click', endXRSession);
    btn.innerHTML = "STOP AR";
    xrSession = session; 
xrSession.addEventListener("end", onSessionEnd);    setupWebGLLayer()
    .then(async () => {
        renderer.xr.setReferenceSpaceType('local');

        await renderer.xr.setSession(xrSession);

        console.log("Hit Test XR session ready!");
        animate();
    })
    .catch(error => {
        console.error("XR setup failed:", error);
    });
}

function setupWebGLLayer() {
    return gl.makeXRCompatible().then(() => {
        xrSession.updateRenderState( {baseLayer: new XRWebGLLayer(xrSession, gl) });
    });
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(time, frame) {
        if (frame) {
var referenceSpace = renderer.xr.getReferenceSpace('local');                var session = frame.session;
                xrViewerPose = frame.getViewerPose(referenceSpace);
                if (hitTestSourceRequested === false) {
                        hitTestSourceRequested = true;
                        session.requestReferenceSpace("viewer").then((referenceSpace) => {
                                session.requestHitTestSource({space: referenceSpace})
                                .then((source) => {
                                        hitTestSource = source;                                        
                                })
                        });

                        session.addEventListener("end", () => {
                                hitTestSourceRequested = false;
                                hitTestSource = null;
                        });
                }

                if (hitTestSource) {
                        var hitTestResults = frame.getHitTestResults(hitTestSource);

                        if (hitTestResults.length > 0) {
                                var hit = hitTestResults[0];
                                reticle.visible = true;
                                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
                        } else {
                                reticle.visible = false;
                        }
                }
        }

        renderer.render(scene, camera);
}

function endXRSession() {
    if (xrSession) {
        xrSession.end().catch(error => {
            console.error("Error ending XR session:", error);
        });
    }
}

function onSessionEnd() {
    xrSession = null;
    hitTestSource = null;
    hitTestSourceRequested = false;

    renderer.setAnimationLoop(null);

    console.log("AR session ended");

    btn.innerHTML = "START AR";
    btn.removeEventListener("click", endXRSession);
    btn.addEventListener("click", onRequestSession);
}