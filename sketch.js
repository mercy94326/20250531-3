let video;
let handpose;
let predictions = [];
let bubbles = [];
let score = 0;
let timer = 60;
let gameStarted = false;
let lastBubbleTime = 0;
let currentGame = "quiz";
let blocks = [];
let holdingBlock = null;
let blockCooldown = 0;
let fruits = [];
let fruitImages = {};
let slicedFruits = [];
let bombs = [];
let bombImg;

let questionSet = [
  { text: "教育科技強調科技與學習的整合", correct: true },
  { text: "建構主義提倡學生主動建構知識", correct: true },
  { text: "教育科技主要應用在學校硬體設備維修", correct: false },
  { text: "多元智能理論與教育科技無關", correct: false },
  { text: "教學媒體包含影片、AR、互動式模擬等", correct: true },
  { text: "教學設計不需要考慮學生學習歷程", correct: false },
  { text: "教育科技與課程設計可結合進行教學創新", correct: true }
];

// 新增 faceapi 相關變數
let faceapi;
let faces = [];
let showVrGlasses = false;
let vrGlassesImg;

function preload() {
  fruitImages['watermelon'] = loadImage('pngtree-cute-anthropomorphic-fruit-watermelon-png-image_2844683-removebg-preview.png');
  fruitImages['watermelon_half'] = loadImage('b248b63a1961e1f38d33f42e2b10066a-removebg-preview.png');
  bombImg = loadImage('pngtree-ignite-the-bomb-image_2233752-removebg-preview.png');
  vrGlassesImg = loadImage('istockphoto-831337754-612x612-removebg-preview.png');
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  // handpose
  handpose = ml5.handpose(video, () => console.log("手部模型已載入"));
  handpose.on("predict", results => predictions = results);

  // faceapi 初始化
  const faceOptions = {
    withLandmarks: true,
    withDescriptors: false,
    minConfidence: 0.5
  };
  faceapi = ml5.faceApi(video, faceOptions, faceModelReady);

  textAlign(CENTER, CENTER);

  setInterval(() => {
    if (gameStarted && timer > 0 && currentGame === "quiz") timer--;
  }, 1000);

  let switchBtn = createButton("切換遊戲模式");
  switchBtn.position(10, 10);
  switchBtn.mousePressed(() => {
    if (currentGame === "quiz") currentGame = "blocks";
    else if (currentGame === "blocks") currentGame = "fruit";
    else currentGame = "quiz";
    resetGame();
  });

  // 新增 VR 眼鏡開關按鈕
  let vrBtn = createButton("VR眼鏡");
  vrBtn.position(width - 80, 10);
  vrBtn.mousePressed(() => {
    showVrGlasses = !showVrGlasses;
  });

  resetGame();
}

function faceModelReady() {
  console.log("臉部模型已載入");
  detectFaces();
}

function detectFaces() {
  faceapi.detect(gotFaces);
}

function gotFaces(err, result) {
  if (err) {
    console.error(err);
    return;
  }
  faces = result;
  detectFaces(); // 持續偵測
}

function resetGame() {
  score = 0;
  if (currentGame === "quiz") {
    timer = 60;
    bubbles = [];
    gameStarted = true;
  } else if (currentGame === "blocks") {
    blocks = [];
    holdingBlock = null;
    blockCooldown = 0;
  } else if (currentGame === "fruit") {
    fruits = [];
    slicedFruits = [];
    bombs = [];
  }
  loop();
}

function draw() {
  background(50);

  // 影像鏡像翻轉顯示
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  // 顯示分數或狀態文字
  fill(255);
  textSize(20);
  stroke(0);
  strokeWeight(3);
  text(
    currentGame === "quiz" ? `分數：${score}  時間：${timer}` :
    currentGame === "blocks" ? `堆積木模式，高度：${blocks.length}` :
    `切西瓜遊戲 分數：${score}`, width / 2, 20
  );
  noStroke();

  // 遊戲邏輯與畫面
  if (currentGame === "quiz") {
    if (!gameStarted) {
      textSize(28);
      fill(255);
      stroke(0);
      strokeWeight(4);
      text("按任意鍵開始遊戲", width / 2, height / 2);
      noStroke();
      return;
    }
    if (timer <= 0) {
      textSize(32);
      fill(255);
      stroke(0);
      strokeWeight(4);
      text("遊戲結束！最終分數：" + score, width / 2, height / 2);
      noStroke();
      noLoop();
      return;
    }
    if (millis() - lastBubbleTime > 2000) {
      let q = random(questionSet);
      bubbles.push(new Bubble(q.text, q.correct));
      lastBubbleTime = millis();
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      bubbles[i].update();
      bubbles[i].display();
      if (bubbles[i].offScreen()) bubbles.splice(i, 1);
    }
  } else if (currentGame === "blocks") {
    for (let block of blocks) block.display();
    if (holdingBlock) holdingBlock.display();
    if (blockCooldown > 0) blockCooldown--;
  } else if (currentGame === "fruit") {
    if (frameCount % 60 === 0) {
      fruits.push(new Fruit());
      if (random(1) < 0.2) bombs.push(new Bomb());
    }
    for (let i = fruits.length - 1; i >= 0; i--) {
      fruits[i].update();
      fruits[i].display();
      if (fruits[i].offScreen()) fruits.splice(i, 1);
    }
    for (let i = slicedFruits.length - 1; i >= 0; i--) {
      slicedFruits[i].update();
      slicedFruits[i].display();
      if (slicedFruits[i].offScreen()) slicedFruits.splice(i, 1);
    }
    for (let i = bombs.length - 1; i >= 0; i--) {
      bombs[i].update();
      bombs[i].display();
      if (bombs[i].offScreen()) bombs.splice(i, 1);
    }
  }

  // 手部追蹤與互動
  drawHandAndDetect();

  // 顯示 VR 眼鏡（如果開啟且有偵測到臉）
  if (showVrGlasses && faces.length > 0) {
    drawVrGlasses();
  }
}

function keyPressed() {
  if (!gameStarted && currentGame === "quiz") {
    gameStarted = true;
    timer = 60;
    score = 0;
    bubbles = [];
    loop();
  }
}

function drawHandAndDetect() {
  if (predictions.length > 0) {
    const hand = predictions[0].landmarks;
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const wrist = hand[0];

    noFill();
    stroke(0, 255, 0);
    strokeWeight(2);
    for (let pt of hand) ellipse(width - pt[0], pt[1], 8, 8);

    let handX = width - indexTip[0];
    let handY = indexTip[1];

    if (currentGame === "quiz") {
      for (let i = bubbles.length - 1; i >= 0; i--) {
        let b = bubbles[i];
        if (dist(width - indexTip[0], indexTip[1], b.x, b.y) < b.r) {
          if (thumbTip[1] < wrist[1] - 30) {
            score += b.correct ? 1 : -1;
            bubbles.splice(i, 1);
          } else if (dist(indexTip[0], indexTip[1], middleTip[0], middleTip[1]) < 30) {
            // 加速泡泡下降
            b.y += 15;
          }
        }
      }
    } else if (currentGame === "blocks") {
      if (!holdingBlock && blockCooldown === 0) {
        if (thumbTip[1] < wrist[1] - 30) {
          blocks.push(new Block(handX, handY));
          blockCooldown = 30;
        }
      } else if (holdingBlock) {
        holdingBlock.x = handX;
        holdingBlock.y = handY;
        if (thumbTip[1] > wrist[1] - 10) {
          blocks.push(holdingBlock);
          holdingBlock = null;
          blockCooldown = 30;
        }
      }
    } else if (currentGame === "fruit") {
      for (let i = fruits.length - 1; i >= 0; i--) {
        let f = fruits[i];
        if (dist(handX, handY, f.x, f.y) < f.size / 2) {
          // 切水果
          score++;
          slicedFruits.push(new SlicedFruit(f.x, f.y, f.img));
          fruits.splice(i, 1);
        }
      }
      for (let i = bombs.length - 1; i >= 0; i--) {
        let b = bombs[i];
        if (dist(handX, handY, b.x, b.y) < b.size / 2) {
          // 撞到炸彈遊戲結束
          textSize(48);
          fill(255, 0, 0);
          text("炸彈爆炸！遊戲結束", width / 2, height / 2);
          noLoop();
        }
      }
    }
  }
}

// Bubble 類別
class Bubble {
  constructor(text, correct) {
    this.text = text;
    this.correct = correct;
    this.x = random(width);
    this.y = height + 30;
    this.r = 40;
    this.speed = 1;
  }
  update() {
    this.y -= this.speed;
  }
  display() {
    fill(this.correct ? "green" : "red");
    ellipse(this.x, this.y, this.r * 2);
    fill(255);
    textSize(14);
    textWrap(WORD);
    text(this.text, this.x, this.y);
  }
  offScreen() {
    return this.y < -this.r;
  }
}

// Block 類別
class Block {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 50;
  }
  display() {
    fill(200, 150, 0);
    rectMode(CENTER);
    rect(this.x, this.y, this.size, this.size);
  }
}

// Fruit 類別
class Fruit {
  constructor() {
    this.size = 80;
    this.x = random(this.size / 2, width - this.size / 2);
    this.y = height + this.size;
    this.speed = random(2, 5);
    this.img = fruitImages['watermelon'];
  }
  update() {
    this.y -= this.speed;
  }
  display() {
    imageMode(CENTER);
    image(this.img, this.x, this.y, this.size, this.size);
  }
  offScreen() {
    return this.y < -this.size;
  }
}

// SlicedFruit 類別
class SlicedFruit {
  constructor(x, y, img) {
    this.x = x;
    this.y = y;
    this.img = fruitImages['watermelon_half'];
    this.speedY = random(1, 3);
    this.alpha = 255;
  }
  update() {
    this.y += this.speedY;
    this.alpha -= 5;
  }
  display() {
    tint(255, this.alpha);
    imageMode(CENTER);
    image(this.img, this.x, this.y, 60, 60);
    noTint();
  }
  offScreen() {
    return this.alpha <= 0;
  }
}

// Bomb 類別
class Bomb {
  constructor() {
    this.size = 70;
    this.x = random(this.size / 2, width - this.size / 2);
    this.y = height + this.size;
    this.speed = random(3, 6);
  }
  update() {
    this.y -= this.speed;
  }
  display() {
    imageMode(CENTER);
    image(bombImg, this.x, this.y, this.size, this.size);
  }
  offScreen() {
    return this.y < -this.size;
  }
}

// VR眼鏡繪製函式
function drawVrGlasses() {
  let face = faces[0];
  let leftEye = face.parts.leftEye;
  let rightEye = face.parts.rightEye;

  // 找眼睛中心點
  let leftX = (leftEye[0]._x + leftEye[3]._x) / 2;
  let leftY = (leftEye[0]._y + leftEye[3]._y) / 2;
  let rightX = (rightEye[0]._x + rightEye[3]._x) / 2;
  let rightY = (rightEye[0]._y + rightEye[3]._y) / 2;

  // 鏡像調整
  let centerX = width - (leftX + rightX) / 2;
  let centerY = (leftY + rightY) / 2;
  let glassesWidth = dist(leftX, leftY, rightX, rightY) * 2.3;
  let glassesHeight = glassesWidth / vrGlassesImg.width * vrGlassesImg.height;

  image(vrGlassesImg, centerX - glassesWidth / 2, centerY - glassesHeight / 2, glassesWidth, glassesHeight);
}
