// DrawRectangle.js
function main() {
    // Retrieve <canvas> element <- (1)
    var canvas = document.getElementById('example');
    if (!canvas) {
        console.log('Failed to retrieve the <canvas> element');
        return;
    }

    var ctx = canvas.getContext('2d');     // Get the rendering context for 2DCG

    ctx.fillStyle = "black";    // create a black canvas
    ctx.fillRect(0, 0, canvas.width, canvas.height); 
}

function handleDrawEvent() {
    const canvas = document.getElementById('example');
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = "black"; // clear canvas before drawing vector
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let x1 = parseFloat(document.getElementById('xCoord1').value); //obtain x and y from user inputs
    let y1 = parseFloat(document.getElementById('yCoord1').value);

    let v1 = new Vector3([x1, y1, 0.0]); // create v1 using Vector3 from cuon-matrix-cse160.js

    let x2 = parseFloat(document.getElementById('xCoord2').value); //obtain x and y from user inputs
    let y2 = parseFloat(document.getElementById('yCoord2').value);

    let v2 = new Vector3([x2, y2, 0.0]); // create v1 using Vector3 from cuon-matrix-cse160.js


    drawVector(ctx, v1, "red"); // draw it in red using drawVector
    drawVector(ctx, v2, "blue"); // draw it in blue using drawVector
}

function handleDrawOperationEvent() {
    const canvas = document.getElementById('example');
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let op = document.getElementById("operation").value;
    let scalar = parseFloat(document.getElementById('scalar').value);

    let x1 = parseFloat(document.getElementById('xCoord1').value);
    let y1 = parseFloat(document.getElementById('yCoord1').value);
    let v1 = new Vector3([x1, y1, 0.0]);

    let x2 = parseFloat(document.getElementById('xCoord2').value);
    let y2 = parseFloat(document.getElementById('yCoord2').value);
    let v2 = new Vector3([x2, y2, 0.0]);

    drawVector(ctx, v1, "red");
    drawVector(ctx, v2, "blue");

    if (op === "add") {
        let v3 = new Vector3([x1, y1, 0.0]);
        v3.add(v2);
        drawVector(ctx, v3, "green");
    } 
    
    else if (op === "sub") {
        let v3 = new Vector3([x1, y1, 0.0]);
        v3.sub(v2);
        drawVector(ctx, v3, "green");
    } 
    
    else if (op === "mul") {
        let v3 = new Vector3([x1, y1, 0.0]);
        let v4 = new Vector3([x2, y2, 0.0]);
        v3.mul(scalar);
        v4.mul(scalar);
        drawVector(ctx, v3, "green");
        drawVector(ctx, v4, "green");
    } 
    
    else if (op === "div") {
        let v3 = new Vector3([x1, y1, 0.0]);
        let v4 = new Vector3([x2, y2, 0.0]);
        v3.div(scalar);
        v4.div(scalar);
        drawVector(ctx, v3, "green");
        drawVector(ctx, v4, "green");
    } 
    
    else if (op === "mag") {
        let mag1 = v1.magnitude();
        let mag2 = v2.magnitude();
        console.log("Magnitude v1:", mag1);
        console.log("Magnitude v2:", mag2);
    }

    else if (op === "norm") {
        let v3 = new Vector3(v1.elements);
        let v4 = new Vector3(v2.elements);

        v3.normalize();
        v4.normalize();

        drawVector(ctx, v3, "green");
        drawVector(ctx, v4, "green");
    }

    else if (op === "ang") {
        let dot = Vector3.dot(v1, v2);

        let mag1 = v1.magnitude();     // magnitudes
        let mag2 = v2.magnitude();


        if (mag1 === 0 || mag2 === 0) {    // avoid division by zero
            return 0;
        }
    
        let cosTheta = dot / (mag1 * mag2); // compute cos(theta)
    
        cosTheta = Math.max(-1, Math.min(1, cosTheta)); // fix floating point issues (VERY IMPORTANT)

        let angleRad = Math.acos(cosTheta); // angle in radians

        let angleDeg = angleRad * (180 / Math.PI); // convert to degrees (usually required)

        console.log("Angle between:", angleDeg);
    }

    else if (op === "area") {
            
        let cross = Vector3.cross(v1, v2); // cross product gives a vector
        let areaParallelogram = cross.magnitude();     // magnitude of cross product
        let areaTriangle = areaParallelogram / 2; // triangle is half
        
        console.log("area:", areaTriangle);
    }
}

function drawVector(ctx, v, color) {
    const canvas = ctx.canvas;

    let cx = canvas.width / 2;     // start from center of canvas
    let cy = canvas.height / 2;

    let scale = 20;     // scale so the vector is visible

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);

    ctx.lineTo(cx + v.elements[0] * scale, cy - v.elements[1] * scale);     // x goes right, y goes up in math (but canvas y goes down, so subtract y)

    ctx.stroke();
}