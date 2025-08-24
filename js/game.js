window.onload = function () {
  // --- Global Variables and Game State ---
  let scene, camera, renderer;
  let spaceship;
  const asteroids = [];
  const bullets = [];
  const keys = {};
  let isGameOver = true;
  let isFlyingIn = false;
  let isPaused = false; // Initialize as not paused
  let score = 0;
  let highScore = 0;
  let startTime;
  let asteroidSpawnTimer = 0;
  let asteroidSpawnInterval = 1000;
  let gameSpeed = 1;

  // Variables for touch controls
  let lastTouchX = 0;
  let lastTouchY = 0;
  let isDragging = false;
  const touchMoveSensitivity = 0.05; // Base sensitivity
  let touchSensitivityMultiplier = 1; // Will scale with screen size

  const stars = [];
  const starCount = 1000;
  const coloredStarChance = 0.02; // 2% chance for a star to be colored

  // UI elements
  const scoreElement = document.getElementById("score");
  const highScoreElement = document.getElementById("highScore");
  const timeElement = document.getElementById("time");
  const startOverlay = document.getElementById("start-overlay");
  const gameOverOverlay = document.getElementById("gameOver-overlay");
  const pauseOverlay = document.getElementById("pause-overlay");
  const finalScoreElement = document.getElementById("final-score");
  const finalTimeElement = document.getElementById("final-time");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const pauseButton = document.getElementById("pauseButton");
  const resumeButton = document.getElementById("resumeButton");
  const canvas = document.getElementById("gameCanvas");

  // --- Scene Setup ---
  function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);

    // Add stars to the scene for a sense of depth
    const starGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const starColors = [
      0xffffff, // White
      0xadd8e6, // Light Blue
      0xffa07a, // Light Salmon (orange-ish)
      0xffff99, // Light Yellow
      0xdda0dd, // Plum (purple-ish)
    ];

    for (let i = 0; i < starCount; i++) {
      let starMaterial;
      if (Math.random() < coloredStarChance) {
        const color = starColors[Math.floor(Math.random() * starColors.length)];
        starMaterial = new THREE.MeshBasicMaterial({ color: color });
      } else {
        starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      }

      const star = new THREE.Mesh(starGeometry, starMaterial);
      star.position.set(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200
      );
      stars.push(star);
      scene.add(star);
    }

    // Camera
    camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 10);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1, 1000);
    pointLight.position.set(0, 0, 100);
    scene.add(pointLight);

    // Create spaceship (simple procedural model)
    createSpaceship();
    loadHighScore();

    // Initialize touch sensitivity multiplier based on initial screen size
    updateTouchSensitivity();

    // --- Event Handlers ---
    window.addEventListener("resize", onWindowResize, false);
    document.addEventListener("keydown", onKeyDown, false);
    document.addEventListener("keyup", onKeyUp, false);
    document.addEventListener("mousedown", onMouseDown, false);
    startButton.addEventListener("click", startGame);
    restartButton.addEventListener("click", startGame);
    pauseButton.addEventListener("click", pauseGame);
    resumeButton.addEventListener("click", unpauseGame);

    // Mobile touch events
    canvas.addEventListener("touchstart", onTouchStart, false);
    canvas.addEventListener("touchmove", onTouchMove, false);
    canvas.addEventListener("touchend", onTouchEnd, false);

    // Page Visibility API - pause when user navigates away
    document.addEventListener("visibilitychange", function() {
      if (document.hidden && !isGameOver && !isFlyingIn && !isPaused) {
        pauseGame();
      }
    });
  }

  // --- Game Logic ---
  let loadedSpaceshipModel = null;
  let spaceshipBoundingSphere = null; // Re-declare here to make sure it's consistent

  function createSpaceship() {
    const loader = new THREE.GLTFLoader();
    loader.load(
      "assets/models/space-ship.glb",
      function (gltf) {
        spaceship = gltf.scene;
        spaceship.scale.set(0.36, 0.36, 0.36);
        spaceship.rotation.x = Math.PI / 2;
        scene.add(spaceship);
        loadedSpaceshipModel = spaceship;

        // Initialize the spaceship with starting position
        spaceship.position.set(0, 0, -120);

        // Compute bounding sphere after model is loaded and positioned
        setTimeout(() => {
          spaceship.updateMatrixWorld(true);
          const tempBox = new THREE.Box3().setFromObject(loadedSpaceshipModel);
          spaceshipBoundingSphere = new THREE.Sphere();
          tempBox.getBoundingSphere(spaceshipBoundingSphere);
          spaceshipBoundingSphere.radius *= 0.8;
          console.log(
            "Spaceship bounding sphere created:",
            spaceshipBoundingSphere
          );
        }, 100);
      },
      undefined,
      function (error) {
        console.error("Error loading spaceship model:", error);
      }
    );
  }

  function loadHighScore() {
    const storedHighScore = localStorage.getItem("highScore");
    if (storedHighScore) {
      highScore = parseInt(storedHighScore, 10);
    }
    highScoreElement.textContent = `High Score: ${highScore}`;
  }

  function saveHighScore() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("highScore", highScore);
      highScoreElement.textContent = `High Score: ${highScore}`;
    }
  }

  function startGame() {
    isGameOver = false;
    isFlyingIn = true;
    isPaused = false;
    score = 0;
    startTime = Date.now();
    gameSpeed = 1;

    if (spaceship) {
      spaceship.position.set(0, 0, -120);
      spaceship.rotation.z = 0;
      // spaceship.rotation.x maintains its base Math.PI / 2 set in createSpaceship
    }

    asteroids.forEach((a) => scene.remove(a));
    bullets.forEach((b) => scene.remove(b));
    asteroids.length = 0;
    bullets.length = 0;

    for (const star of stars) {
      star.position.z = (Math.random() - 0.5) * 200;
      star.position.x = (Math.random() - 0.5) * 200;
      star.position.y = (Math.random() - 0.5) * 200;
    }

    // Hide all overlays and show UI when starting game
    startOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
    document.querySelector(".ui-container").style.display = "flex";
    pauseButton.classList.remove("hidden");

    // Ensure we're in the right state
    isPaused = false;
    animate(); // Start the animation loop
  }

  function gameOver(reason = "Unknown") {
    console.log("Game Over triggered! Reason:", reason);
    isGameOver = true;
    saveHighScore();
    finalScoreElement.textContent = `Final Score: ${score}`;
    const finalTime = Math.floor((Date.now() - startTime) / 1000);
    finalTimeElement.textContent = `Time Played: ${finalTime}s`;
    gameOverOverlay.classList.remove("hidden");
    pauseButton.classList.add("hidden");
    cancelAnimationFrame(animationFrameId);
  }

  function pauseGame() {
    if (isGameOver || isFlyingIn || isPaused) return;
    isPaused = true;
    pauseOverlay.classList.remove("hidden");
    cancelAnimationFrame(animationFrameId);
  }

  function unpauseGame() {
    console.log("unpauseGame");
    if (isGameOver || isFlyingIn) return; // Only check game over and flying in
    isPaused = false;
    pauseOverlay.classList.add("hidden");
    animate();
  }

  function getBoundaryLimits() {
    const paddingX = 6;
    const paddingY = 5;

    const aspect = window.innerWidth / window.innerHeight;
    const frustumHeight =
      camera.position.z * Math.tan((camera.fov * Math.PI) / 360) * 2;
    const frustumWidth = frustumHeight * aspect;

    return {
      xLimit: frustumWidth / 2 - paddingX,
      yLimit: frustumHeight / 2 - paddingY,
    };
  }

  function update() {
    if (isGameOver || isPaused) return;

    if (isFlyingIn) {
      if (spaceship) {
        spaceship.position.z += 1.0;
        if (spaceship.position.z >= 5) {
          isFlyingIn = false;
          spaceship.position.z = 5;
        }
      }
    }

    for (const star of stars) {
      star.position.z += 0.5 * gameSpeed;
      if (star.position.z > camera.position.z + 5) {
        star.position.z = -200;
        star.position.x = (Math.random() - 0.5) * 200;
        star.position.y = (Math.random() - 0.5) * 200;
      }
    }

    if (!isFlyingIn && spaceship) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      timeElement.textContent = `Time: ${elapsed}s`;
      scoreElement.textContent = `Score: ${score}`;

      gameSpeed = 1 + elapsed / 30;

      const speed = 0.15 * gameSpeed;
      let moveX = 0;
      let moveY = 0;

      if (keys["ArrowUp"] || keys["w"]) moveY += 1;
      if (keys["ArrowDown"] || keys["s"]) moveY -= 1;
      if (keys["ArrowLeft"] || keys["a"]) moveX -= 1;
      if (keys["ArrowRight"] || keys["d"]) moveX += 1;

      spaceship.position.x += moveX * speed;
      spaceship.position.y += moveY * speed;

      const tiltFactor = Math.PI / 12;
      const lerpFactor = 0.2;

      spaceship.rotation.z = THREE.MathUtils.lerp(
        spaceship.rotation.z,
        -moveX * tiltFactor,
        lerpFactor
      );
      const basePitch = Math.PI / 2;
      spaceship.rotation.x = THREE.MathUtils.lerp(
        spaceship.rotation.x,
        basePitch + -moveY * tiltFactor,
        lerpFactor
      );

      const { xLimit, yLimit } = getBoundaryLimits();
      spaceship.position.x = Math.max(
        -xLimit,
        Math.min(xLimit, spaceship.position.x)
      );
      spaceship.position.y = Math.max(
        -yLimit,
        Math.min(yLimit, spaceship.position.y)
      );

      asteroidSpawnTimer += 1000 / 60;
      const currentSpawnInterval = Math.max(
        100,
        asteroidSpawnInterval / gameSpeed
      );
      if (asteroidSpawnTimer > currentSpawnInterval) {
        spawnAsteroid();
        asteroidSpawnTimer = 0;
      }

      for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];
        asteroid.position.z += 0.3 * gameSpeed;
        asteroid.rotation.x += asteroid.rotationSpeed.x * gameSpeed;
        asteroid.rotation.y += asteroid.rotationSpeed.y * gameSpeed;
        asteroid.rotation.z += asteroid.rotationSpeed.z * gameSpeed;

        // Ensure asteroid bounding sphere is computed
        const asteroidBoundingSphere = new THREE.Sphere();
        // computeBoundingSphere is called here for asteroid's *geometry* once.
        // We need to apply the asteroid's *world* matrix for its current position/rotation/scale.
        if (!asteroid.geometry.boundingSphere)
          asteroid.geometry.computeBoundingSphere(); // Only if not already computed
        asteroidBoundingSphere
          .copy(asteroid.geometry.boundingSphere)
          .applyMatrix4(asteroid.matrixWorld);
        asteroidBoundingSphere.radius *= 0.8;

        // Perform collision check only if the spaceship model is loaded and game is actually started
        if (!isFlyingIn && loadedSpaceshipModel && spaceshipBoundingSphere) {
          // Update matrix world for accurate collision detection
          asteroid.updateMatrixWorld(true);
          spaceship.updateMatrixWorld(true);

          // Update spaceship bounding sphere position
          const currentSpaceshipSphere = spaceshipBoundingSphere.clone();
          currentSpaceshipSphere.center.copy(spaceship.position);

          const distance = currentSpaceshipSphere.center.distanceTo(
            asteroidBoundingSphere.center
          );
          const collisionDistance =
            currentSpaceshipSphere.radius + asteroidBoundingSphere.radius;

          if (distance < collisionDistance) {
            console.log("Collision detected!", {
              distance,
              collisionDistance,
              spaceshipPos: spaceship.position,
              asteroidPos: asteroid.position,
              spaceshipRadius: currentSpaceshipSphere.radius,
              asteroidRadius: asteroidBoundingSphere.radius,
            });
            gameOver("Asteroid collision");
            return;
          }
        }

        if (asteroid.position.z > camera.position.z + 5) {
          scene.remove(asteroid);
          asteroids.splice(i, 1);
        }
      }

      for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.position.z -= 0.5 * gameSpeed;

        const bulletBoundingSphere = new THREE.Sphere();
        if (!bullet.geometry.boundingSphere)
          bullet.geometry.computeBoundingSphere(); // Only if not already computed
        bulletBoundingSphere
          .copy(bullet.geometry.boundingSphere)
          .applyMatrix4(bullet.matrixWorld);

        for (let j = asteroids.length - 1; j >= 0; j--) {
          const asteroid = asteroids[j];
          const asteroidBoundingSphere = new THREE.Sphere();
          if (!asteroid.geometry.boundingSphere)
            asteroid.geometry.computeBoundingSphere(); // Only if not already computed
          asteroidBoundingSphere
            .copy(asteroid.geometry.boundingSphere)
            .applyMatrix4(asteroid.matrixWorld);
          asteroidBoundingSphere.radius *= 0.8;

          if (bulletBoundingSphere.intersectsSphere(asteroidBoundingSphere)) {
            scene.remove(bullet);
            bullets.splice(i, 1);
            scene.remove(asteroid);
            asteroids.splice(j, 1);
            score += 10;
            break;
          }
        }

        if (bullet.position.z < -200) {
          scene.remove(bullet);
          bullets.splice(i, 1);
        }
      }
    }
  }

  function spawnAsteroid() {
    const asteroidGeometry = new THREE.DodecahedronGeometry(1.5, 0);
    const asteroidSize = 1;
    const geometry = asteroidGeometry.clone();
    geometry.scale(asteroidSize, asteroidSize, asteroidSize);

    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(
        `rgb(${Math.floor(Math.random() * 50) + 100}, ${
          Math.floor(Math.random() * 50) + 90
        }, ${Math.floor(Math.random() * 50) + 80})`
      ),
      shininess: 10,
      flatShading: true,
    });
    const asteroid = new THREE.Mesh(geometry, material);

    asteroid.rotation.x = Math.random() * Math.PI * 2;
    asteroid.rotation.y = Math.random() * Math.PI * 2;
    asteroid.rotation.z = Math.random() * Math.PI * 2;
    asteroid.rotationSpeed = {
      x: (Math.random() - 0.5) * 0.02,
      y: (Math.random() - 0.5) * 0.02,
      z: (Math.random() - 0.5) * 0.02,
    };

    const { xLimit, yLimit } = getBoundaryLimits();
    const x = (Math.random() - 0.5) * (xLimit + 5);
    const y = (Math.random() - 0.5) * (yLimit + 5);
    const z = -200;

    asteroid.position.set(x, y, z);

    asteroids.push(asteroid);
    scene.add(asteroid);
  }

  function shootBullet() {
    if (isGameOver || isFlyingIn) return;
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const bullet = new THREE.Mesh(geometry, material);

    bullet.position.set(
      spaceship.position.x,
      spaceship.position.y,
      spaceship.position.z + 1
    );
    bullets.push(bullet);
    scene.add(bullet);
  }

  function checkCollision(obj1, obj2) {
    // This function is still mostly illustrative, as direct sphere intersection
    // is handled in the update loop for the primary collision checks.
    const box1 = new THREE.Box3().setFromObject(obj1);
    const box2 = new THREE.Box3().setFromObject(obj2);
    return box1.intersectsBox(box2);
  }

  // --- Main Animation Loop ---
  let animationFrameId;
  function animate() {
    if (isGameOver || isPaused) {
      return;
    }
    animationFrameId = requestAnimationFrame(animate);
    update();
    renderer.render(scene, camera);
  }

  // --- Event Handlers ---
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateTouchSensitivity(); // Recalculate touch sensitivity on resize
  }

  // Adjust touch sensitivity based on screen size/density
  function updateTouchSensitivity() {
    // Smaller screens often need higher touch sensitivity to cover more ground with less finger movement.
    // This is a heuristic, adjust values as needed.
    const baseWidth = 800; // Reference width (e.g., a tablet in landscape)
    touchSensitivityMultiplier = Math.sqrt(window.innerWidth / baseWidth);
    // Clamp to avoid extreme values
    touchSensitivityMultiplier = Math.max(
      0.5,
      Math.min(2.0, touchSensitivityMultiplier)
    );
  }

  // Desktop Key and Mouse Events
  function onKeyDown(event) {
    keys[event.key] = true;
    if (event.key === " " && !isGameOver && !isFlyingIn && !isPaused) {
      shootBullet();
    }
    if (event.key === "Escape") {
      if (!isGameOver && !isFlyingIn) {
        if (isPaused) {
          unpauseGame();
        } else {
          pauseGame();
        }
      }
    }
  }

  function onKeyUp(event) {
    keys[event.key] = false;
  }

  function onMouseDown(event) {
    if (!isGameOver && !isFlyingIn && !isPaused) {
      shootBullet();
    }
  }

  // Mobile Touch Events
  function onTouchStart(event) {
    event.preventDefault();
    if (isGameOver || isFlyingIn || isPaused) return;
    const touch = event.touches[0];
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
    isDragging = true;

    if (event.touches.length === 1) {
      shootBullet();
    }
  }

  function onTouchMove(event) {
    event.preventDefault();
    if (isGameOver || isFlyingIn || isPaused || !isDragging) return;
    const touch = event.touches[0];
    // Apply multiplier to touch movement
    const deltaX =
      (touch.clientX - lastTouchX) *
      touchMoveSensitivity *
      touchSensitivityMultiplier;
    const deltaY =
      -(touch.clientY - lastTouchY) *
      touchMoveSensitivity *
      touchSensitivityMultiplier;

    spaceship.position.x += deltaX;
    spaceship.position.y += deltaY;

    const { xLimit, yLimit } = getBoundaryLimits();
    spaceship.position.x = Math.max(
      -xLimit,
      Math.min(xLimit, spaceship.position.x)
    );
    spaceship.position.y = Math.max(
      -yLimit,
      Math.min(yLimit, spaceship.position.y)
    );

    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
  }

  function onTouchEnd(event) {
    event.preventDefault();
    isDragging = false;
  }

  // --- Initialization ---
  init();
};
