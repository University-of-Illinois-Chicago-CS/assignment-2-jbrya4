import vertexShaderSrc from './vertex.glsl.js';
import fragmentShaderSrc from './fragment.glsl.js'

var gl = null;
var box_vao = null;
var gray_vao = null;
var program = null;
var vertexCount = 0;
var gray_vertexCount = 0;
var box_vertexCount = 0;
var uniformModelViewLoc = null;
var uniformProjectionLoc = null;
var heightmapData = null;

var leftVertZ = 1;
var leftHorY = 1;
var wheelZoom = 1;
var rightPan = 1;

var modelMatrix;

function processImage(img)
{
	// draw the image into an off-screen canvas
	var off = document.createElement('canvas');
	
	var sw = img.width, sh = img.height;
	off.width = sw; off.height = sh;
	
	var ctx = off.getContext('2d');
	ctx.drawImage(img, 0, 0, sw, sh);
	
	// read back the image pixel data
	var imgd = ctx.getImageData(0,0,sw,sh);
	var px = imgd.data;
	
	// create a an array will hold the height value
	var heightArray = new Float32Array(sw * sh);
	
	// loop through the image, rows then columns
	for (var y=0;y<sh;y++) 
	{
		for (var x=0;x<sw;x++) 
		{
			// offset in the image buffer
			var i = (y*sw + x)*4;
			
			// read the RGB pixel value
			var r = px[i+0], g = px[i+1], b = px[i+2];
			
			// convert to greyscale value between 0 and 1
			var lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255.0;

			// store in array
			heightArray[y*sw + x] = lum;
		}
	}

	return {
		data: heightArray,
		width: sw,
		height: sh
	};
}

window.loadImageFile = function(event)
{

	var f = event.target.files && event.target.files[0];
	if (!f) return;
	
	// create a FileReader to read the image file
	var reader = new FileReader();
	reader.onload = function() 
	{
		// create an internal Image object to hold the image into memory
		var img = new Image();
		img.onload = function() 
		{
			// heightmapData is globally defined
			heightmapData = processImage(img);
			
			/*
				DONE: using the data in heightmapData, create a triangle mesh
					heightmapData.data: array holding the actual data, note that 
					this is a single dimensional array the stores 2D data in row-major order

					heightmapData.width: width of map (number of columns)
					heightmapData.height: height of the map (number of rows)
			*/
			console.log('loaded image: ' + heightmapData.width + ' x ' + heightmapData.height);

			let x = heightmapData.width;
			let z = heightmapData.height;

			let heightMap = heightmapData.data;
			// console.log(heightMap);

			let positions = [];
			https://www.geeksforgeeks.org/dsa/emulating-a-2-d-array-using-1-d-array/

			//each quad makes two triangles
			//every quad needs a right and bottom pixel to form
            
			//skip the last column and last row because there are no more pixels below or to the right
			
			for (let row = 0; row < z-1; row++){
				for (let col = 0; col < x-1; col++){

					//positions of the pixels to form the triangles
					let top_left = heightMap[(row*x) + col];
					//skip last column so add 1
					let top_right = heightMap[(row*x) + (col +1)];
					//skip last row so add 1
					let bot_left= heightMap[ ((row+1)*x)+ col];
					//skip last row and last column 
					let bot_right = heightMap [ ((row+1)*x)+(col+1)];

					//x and z positions

					 let top_left_x = col/x;
					 let top_right_x = (col + 1)/x;
					 let bot_left_x = col/x; 
                     let bot_right_x = (col + 1)/x;

					let top_left_z = row/z;
					let top_right_z = row/z;
					let bot_left_z = (row + 1)/z;
					let bot_right_z = (row + 1)/z;

					//y is mapped to the height
					let top_left_y = top_left ;
		        	let top_right_y = top_right;
                    let bot_left_y = bot_left ;
                    let bot_right_y = bot_right ;

					/*
                      TL TR     A B    ABC makes first triangle
					  BL BR     C D    BCD makes second triangle
					*/

                    positions.push(
                    top_left_x, top_left_y, top_left_z,
                    top_right_x, top_right_y, top_right_z,
                    bot_left_x, bot_left_y, bot_left_z);

                    positions.push(
                    top_right_x, top_right_y,top_right_z,
                    bot_right_x, bot_right_y,bot_right_z,
                    bot_left_x, bot_left_y, bot_left_z);
				}
			}

	    console.log("positions sample:", positions.slice(0, 100));

	    let posBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(positions));

        let posAttribLoc = gl.getAttribLocation(program, "position");

		//color is calculated in vertex shader

        gray_vao = createVAO(gl, posAttribLoc, posBuffer, null, null,null,null);

        gray_vertexCount = positions.length / 3;
    
	};
		
		img.onerror = function() 
		{
			console.error("Invalid image file.");
			alert("The selected file could not be loaded as an image.");
		};

		// the source of the image is the data load from the file
		img.src = reader.result;
	};
	reader.readAsDataURL(f);
}

function setupViewMatrix(eye, target)
{
    var forward = normalize(subtract(target, eye));
    var upHint  = [0, 1, 0];

    var right = normalize(cross(forward, upHint));
    var up    = cross(right, forward);

    var view = lookAt(eye, target, up);
    return view;

}

//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Strict_equality
//returns rotation value in radians
function Rotation(axis) {
	let div = document.querySelector("#config");
	let radians = 0;
	if (axis === 0) {
		let slider = div.querySelector("#rotationY");
		let rot_y = Number(slider.value);
		radians = (rot_y  * Math.PI) / 180 ;
	}
	else if (axis === 1){
		let slider = div.querySelector("#rotationZ");
		let rot_z = Number(slider.value);
		radians = (rot_z  * Math.PI) / 180 ;
	}
	else if(axis === 2){
		let slider = div.querySelector("#rotationX");
		let rot_x = Number(slider.value);
		radians = (rot_x  * Math.PI) / 180 ;
	}
    return radians;
}

function changeElevation() {
	let div = document.querySelector("#config");
    let slider = div.querySelector("#height");
	let h = Number(slider.value);
    return h;
}

function changeZoom(){
	let div = document.querySelector("#config");
    let slider = div.querySelector("#scale");
	let zoom = Number(slider.value);
    return zoom;
}
function changePan(){
	let div = document.querySelector("#config");
	let slider = div.querySelector("#pan");
	let pan = Number(slider.value);
	return pan;
}

function draw()
{

	var fovRadians = 70 * Math.PI / 180;
	var aspectRatio = +gl.canvas.width / +gl.canvas.height;
	var nearClip = 0.001;
	var farClip = 20.0;

	// perspective projection
	var projectionMatrix = perspectiveMatrix(
		fovRadians,
		aspectRatio,
		nearClip,
		farClip,
	);
   
    // var orthographicMatrix = orthographicMatrix(0,0,1,1,-1,1);

	// eye and target
	var eye = [0, 5, 5];
	var target = [0, 0, 0];

	modelMatrix = identityMatrix();

	// DONE: set up transformations to the model
	modelMatrix = multiplyMatrices(scaleMatrix(4,1.5,3),modelMatrix);
	modelMatrix = multiplyMatrices(translateMatrix(-2,1,1),modelMatrix);

	//flips mesh forward and backward
	let rotateX = rotateXMatrix(Rotation(2));
    modelMatrix = multiplyMatrices(rotateX,modelMatrix);

	//turns mesh left and right
	let rotateY = rotateYMatrix(Rotation(0));	
    modelMatrix = multiplyMatrices(rotateY,modelMatrix);

	//flips the mesh left and right
	let rotateZ = rotateZMatrix(Rotation(1));
	modelMatrix = multiplyMatrices(rotateZ,modelMatrix)

	if(gray_vao) {
	 //Height slider changes elevation
	 let max_y = heightmapData.height;
	 modelMatrix = multiplyMatrices(scaleMatrix(1,changeElevation()/max_y*4,1),modelMatrix);
	} else if(box_vao){
	 modelMatrix = multiplyMatrices(scaleMatrix(1,changeElevation()*0.1,1),modelMatrix);
	}

	//zooming in and out
    modelMatrix = multiplyMatrices(scaleMatrix(changeZoom()*0.01,changeZoom()*0.01,changeZoom()*0.01),modelMatrix);

    //pan with the slider
	modelMatrix = multiplyMatrices(translateMatrix(changePan()*0.05,changePan()*0.05,0),modelMatrix);

	//mouse options
	modelMatrix = multiplyMatrices(leftHorY, modelMatrix);
	modelMatrix = multiplyMatrices(leftVertZ, modelMatrix);
	modelMatrix = multiplyMatrices(rightPan,modelMatrix);
	modelMatrix = multiplyMatrices(scaleMatrix(wheelZoom,wheelZoom,wheelZoom),modelMatrix);
	
	// setup viewing matrix
	var eyeToTarget = subtract(target, eye);
	var viewMatrix = setupViewMatrix(eye, target);

	// model-view Matrix = view * model
	var modelviewMatrix = multiplyMatrices(viewMatrix, modelMatrix);

	// enable depth testing
	gl.enable(gl.DEPTH_TEST);

	// disable face culling to render both sides of the triangles
	gl.disable(gl.CULL_FACE);

	gl.clearColor(0.2, 0.2, 0.2, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.clear(gl.DEPTH_BUFFER_BIT);

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.useProgram(program);
	
	// update modelview and projection matrices to GPU as uniforms
	gl.uniformMatrix4fv(uniformModelViewLoc, false, new Float32Array(modelviewMatrix));
	gl.uniformMatrix4fv(uniformProjectionLoc, false, new Float32Array(projectionMatrix));

if (gray_vao) {
    gl.bindVertexArray(gray_vao);
    gl.drawArrays(gl.TRIANGLES, 0, gray_vertexCount);
	vertexCount = gray_vertexCount;
} else if(box_vao) {
    // draw the box
    gl.bindVertexArray(box_vao);
    gl.drawArrays(gl.TRIANGLES, 0, box_vertexCount);
	vertexCount = box_vertexCount;
}	

	requestAnimationFrame(draw);

}

function createBox()
{
	function transformTriangle(triangle, matrix) {
		var v1 = [triangle[0], triangle[1], triangle[2], 1];
		var v2 = [triangle[3], triangle[4], triangle[5], 1];
		var v3 = [triangle[6], triangle[7], triangle[8], 1];

		var newV1 = multiplyMatrixVector(matrix, v1);
		var newV2 = multiplyMatrixVector(matrix, v2);
		var newV3 = multiplyMatrixVector(matrix, v3);

		return [
			newV1[0], newV1[1], newV1[2],
			newV2[0], newV2[1], newV2[2],
			newV3[0], newV3[1], newV3[2]
		];
	}

	var box = [];

	var triangle1 = [
		-1, -1, +1,
		-1, +1, +1,
		+1, -1, +1,
	];
	box.push(...triangle1)

	var triangle2 = [
		+1, -1, +1,
		-1, +1, +1,
		+1, +1, +1
	];
	box.push(...triangle2);

	// 3 rotations of the above face
	for (var i=1; i<=3; i++) 
	{
		var yAngle = i* (90 * Math.PI / 180);
		var yRotMat = rotateYMatrix(yAngle);

		var newT1 = transformTriangle(triangle1, yRotMat);
		var newT2 = transformTriangle(triangle2, yRotMat);

		box.push(...newT1);
		box.push(...newT2);
	}

	// a rotation to provide the base of the box
	var xRotMat = rotateXMatrix(90 * Math.PI / 180);
	box.push(...transformTriangle(triangle1, xRotMat));
	box.push(...transformTriangle(triangle2, xRotMat));


	return {
		positions: box
	};

}

var isDragging = false;
var startX, startY;
var leftMouse = false;

function addMouseCallback(canvas)
{
	isDragging = false;

	canvas.addEventListener("mousedown", function (e) 
	{
		if (e.button === 0) {
			console.log("Left button pressed");
			leftMouse = true;
		} else if (e.button === 2) {
			console.log("Right button pressed");
			leftMouse = false;
		}

		isDragging = true;
		startX = e.offsetX;
		startY = e.offsetY;
	});

	canvas.addEventListener("contextmenu", function(e)  {
		e.preventDefault(); // disables the default right-click menu
	});


	canvas.addEventListener("wheel", function(e)  {
		e.preventDefault(); // prevents page scroll

		if (e.deltaY < 0) 
		{
			console.log("Scrolled up")
			// console.log(e.deltaY);
			// zoom in

			//scaling factor
			wheelZoom *= 1.05;
			
		} else {
			console.log("Scrolled down");
			//  zoom out

			//scaling factor
			wheelZoom /= 1.05;
		}
	});

	document.addEventListener("mousemove", function (e) {
		if (!isDragging) return;
		var currentX = e.offsetX;
		var currentY = e.offsetY;

		var deltaX = currentX - startX;
		var deltaY = currentY - startY;
		console.log('mouse drag by: ' + deltaX + ', ' + deltaY);

		// implement dragging logic
		
	if(leftMouse){
       leftHorY = rotateYMatrix(deltaX * Math.PI/180); 
       leftVertZ = rotateZMatrix(deltaY * Math.PI/180);
	}
		if(!leftMouse){
			rightPan = translateMatrix(deltaX*0.01,0,deltaY*0.01);
		}
	});

	document.addEventListener("mouseup", function () {
		isDragging = false;
	});

	document.addEventListener("mouseleave", () => {
		isDragging = false;
	});
}

function initialize() 
{
	var canvas = document.querySelector("#glcanvas");
	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;

	gl = canvas.getContext("webgl2");

	// add mouse callbacks
	addMouseCallback(canvas);

	var box = createBox();
	box_vertexCount = box.positions.length / 3;		// vertexCount is global variable used by draw()
	// console.log(box);

	// create buffers to put in box
	var boxVertices = new Float32Array(box['positions']);
	var posBuffer = createBuffer(gl, gl.ARRAY_BUFFER, boxVertices);

	var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
	var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);
	program = createProgram(gl, vertexShader, fragmentShader);

	// attributes (per vertex)
	var posAttribLoc = gl.getAttribLocation(program, "position");

	// uniforms
	uniformModelViewLoc = gl.getUniformLocation(program, 'modelview');
	uniformProjectionLoc = gl.getUniformLocation(program, 'projection');

	box_vao = createVAO(gl, 
		// positions
		posAttribLoc, posBuffer, 

		// normals (unused in this assignments)
		null, null, 

		// colors (not needed--computed by shader)
		null, null
	);

	window.requestAnimationFrame(draw);
}

window.onload = initialize();
