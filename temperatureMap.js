/*global console*/
/*jslint bitwise: true */

var TemperatureMap = function (ctx) {
    'use strict';
    this.ctx = ctx;
    this.points = [];
    this.polygon = [];
    this.limits = {
        xMin: 0,
        xMax: 0,
        yMin: 0,
        yMax: 0
    };
};

TemperatureMap.crossProduct = function (o, a, b) {
    'use strict';
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
};

TemperatureMap.pointInPolygon = function (point, vs) {
    'use strict';
    var x = point.x,
        y = point.y,
        inside = false,
        i = 0,
        j = 0,
        xi = 0,
        xj = 0,
        yi = 0,
        yj = 0,
        intersect = false;

    j = vs.length - 1;
    for (i = 0; i < vs.length; i = i + 1) {
        xi = vs[i].x;
        yi = vs[i].y;
        xj = vs[j].x;
        yj = vs[j].y;

        intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) {
            inside = !inside;
        }
        j = i;
    }

    return inside;
};

TemperatureMap.squareDistance = function (p0, p1) {
    'use strict';
    var x = Math.abs(p0.x - p1.x),
        y = Math.abs(p0.y - p1.y);

    return x * x + y * y;
};

TemperatureMap.hslToRgb = function (h, s, l) {
    'use strict';
    var r, g, b, hue2rgb, q, p;

    if (s === 0) {
        r = g = b = l;
    } else {
        hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) { t += 1; }
            if (t > 1) { t -= 1; }
            if (t < 1 / 6) { return p + (q - p) * 6 * t; }
            if (t < 1 / 2) { return q; }
            if (t < 2 / 3) { return p + (q - p) * (2 / 3 - t) * 6; }
            return p;
        };

        q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

TemperatureMap.prototype.getColor = function (levels, value) {
    'use strict';
    var val = value,
        tmp = 0,
        lim = 0.55,
        min = -30,
        max = 50,
        dif = max - min,
        lvs = 25;

    if (val < min) {
        val = min;
    }
    if (val > max) {
        val = max;
    }

    tmp = 1 - (1 - lim) - (((val - min) * lim) / dif);

    if (levels) {
        tmp = Math.round(tmp * lvs) / lvs;
    }

    return TemperatureMap.hslToRgb(tmp, 1, 0.5);
};

TemperatureMap.prototype.getPointValue = function (limit, point) {
    'use strict';
    var counter = 0,
        tmp = 0.0,
        arr = [],
        inv = 0.0,
        t = 0.0,
        b = 0.0,
        pwr = 2,
        ptr;

    if (limit > this.points.length) {
        limit = this.points.length;
    }

    // From : https://en.wikipedia.org/wiki/Inverse_distance_weighting

    if (TemperatureMap.pointInPolygon(point, this.polygon)) {

        for (counter = 0; counter < this.points.length; counter = counter + 1) {
            arr[counter] = {
                distance: TemperatureMap.squareDistance(point, this.points[counter]),
                point: point,
                position: counter
            };
        }

        arr.sort(function (a, b) {
            return a.distance === b.distance ? a.position - b.position : a.distance - b.distance;
        });

        for (counter = 0; counter < limit; counter = counter + 1) {
            ptr = arr[counter];
            if (ptr.distance === 0) {
                return this.points[ptr.position].value;
            } else {
                inv = 1 / Math.pow(ptr.distance, pwr);
                t = t + inv * this.points[ptr.position].value;
                b = b + inv;
            }
        }

        return t / b;
    } else {
        return -255;
    }
};

TemperatureMap.prototype.setConvexhullPolygon = function (points) {
    'use strict';
    var lower = [],
        upper = [],
        i = 0;
    
    // Sort by 'y' to get yMin/yMax
    points.sort(function (a, b) {
        return a.y === b.y ? a.x - b.x : a.y - b.y;
    });
    
    this.limits.yMin = points[0].y;
    this.limits.yMax = points[points.length - 1].y;

    // Sort by 'x' to get convex hull polygon and xMin/xMax
    points.sort(function (a, b) {
        return a.x === b.x ? a.y - b.y : a.x - b.x;
    });
    
    this.limits.xMin = points[0].x;
    this.limits.xMax = points[points.length - 1].x;
    
    // Get convex hull polygon from points sorted by 'x'
    for (i = 0; i < points.length; i = i + 1) {
        while (lower.length >= 2 && TemperatureMap.crossProduct(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
            lower.pop();
        }
        lower.push(points[i]);
    }

    for (i = points.length - 1; i >= 0; i = i - 1) {
        while (upper.length >= 2 && TemperatureMap.crossProduct(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
            upper.pop();
        }
        upper.push(points[i]);
    }

    upper.pop();
    lower.pop();
    this.polygon = lower.concat(upper);
};

TemperatureMap.prototype.setPoints = function (arr, width, height) {
    'use strict';
    this.points = arr;
    this.width = width;
    this.height = height;
    this.setConvexhullPolygon(this.points);
};

TemperatureMap.prototype.setRandomPoints = function (points, width, height) {
    'use strict';
    var counter = 0,
        x = 0,
        y = 0,
        v = 0.0,
        rst = [];

    for (counter = 0; counter < points; counter = counter + 1) {

        x = parseInt((Math.random() * 100000) % width, 10);
        y = parseInt((Math.random() * 100000) % height, 10);
        v = (Math.random() * 100) / 2;

        if (Math.random() > 0.5) { v = -v; }
        if (Math.random() > 0.5) { v = v + 30; }

        rst.push({ x: x, y: y, value: v });
    }

    this.setPoints(rst, width, height);
};

TemperatureMap.prototype.drawLow = function (limit, res, clean, callback) {
    'use strict';
    var self = this,
        ctx = this.ctx,
        PI2 = 2 * Math.PI,
        status = { x: this.limits.xMin, y: this.limits.yMin },
        recursive = function () {
            window.requestAnimationFrame(function (timestamp) {
                var col = [],
                    cnt = 0,
                    x = 0,
                    y = 0,
                    val = 0.0,
                    str = '',
                    gradient;

                x = status.x;
                y = status.y;

                for (cnt = 0; cnt < 750; cnt = cnt + 1) {
                    val = self.getPointValue(limit + 1, { x: x, y: y });
                    if (val !== -255) {
                        col = self.getColor(false, val);
                        str = 'rgba(' + col[0] + ', ' + col[1] + ', ' + col[2] + ', ';
                        gradient = ctx.createRadialGradient(x, y, 1, x, y, res);
                        gradient.addColorStop(0, str + '0.5)');
                        gradient.addColorStop(1, str + '0)');
                        ctx.fillStyle = gradient;
                        ctx.beginPath();
                        ctx.arc(x, y, res, 0, PI2, false);
                        ctx.fill();
                    }
                    x = x + res;
                    if (x >= self.limits.xMax) {
                        x = self.limits.xMin;
                        y = y + res;
                        if (y >= self.limits.yMax) {
                            break;
                        }
                    }
                }

                status.x = x;
                status.y = y;

                if (y <= self.limits.yMax) {
                    recursive();
                } else if (typeof callback === 'function') {
                    
                    // Erase polygon outsides
                    if (clean && self.polygon.length > 1) {
                        ctx.globalCompositeOperation = 'destination-in';
                        ctx.fillStyle = 'rgb(255, 255, 255)';
                        ctx.beginPath();
                        ctx.moveTo(self.polygon[0].x, self.polygon[0].y);
                        for (cnt = 1; cnt < self.polygon.length; cnt = cnt + 1) {
                            ctx.lineTo(self.polygon[cnt].x, self.polygon[cnt].y);
                        }
                        ctx.lineTo(self.polygon[0].x, self.polygon[0].y);
                        ctx.closePath();
                        ctx.fill();
                        ctx.globalCompositeOperation = 'source-over';
                    }
                    
                    callback();
                }
            });
        };

    recursive();
};

TemperatureMap.prototype.drawFull = function (levels, callback) {
    'use strict';
    var self = this,
        ctx = this.ctx,
        img = this.ctx.getImageData(0, 0, self.width, self.height),
        status = { x: this.limits.xMin, y: this.limits.yMin, step: 0 },
        steps = 3,
        recursive = function () {
            window.requestAnimationFrame(function (timestamp) {
                var col = [],
                    cnt = 0,
                    idx = 0,
                    x = 0,
                    y = 0,
                    w = 0,
                    val = 0.0;

                x = status.x;
                y = status.y;
                w = self.width * 4;

                for (cnt = 0; cnt < 500; cnt = cnt + 1) {
                    val = self.getPointValue(self.points.length, { x: x, y: y });
                    idx = x * 4 + y * w;
                    if (val !== -255) {
                        col = self.getColor(levels, val);
                        img.data[idx] = col[0];
                        img.data[idx + 1] = col[1];
                        img.data[idx + 2] = col[2];
                        img.data[idx + 3] = 128;
                    } else {
                        img.data[idx] = 0;
                        img.data[idx + 1] = 0;
                        img.data[idx + 2] = 0;
                        img.data[idx + 3] = 0;
                    }
                    x = x + 1;
                    if (x >= self.limits.xMax) {
                        x = self.limits.xMin;
                        y = y + steps;
                    }
                }

                ctx.putImageData(img, 0, 0);
                status.x = x;

                if (y <= self.limits.yMax) {
                    status.y = y;
                    recursive();
                } else if (status.step !== (steps - 1)) {
                    status.step = status.step + 1;
                    status.x = self.limits.xMin;
                    status.y = self.limits.yMin + status.step;
                    recursive();
                } else if (typeof callback === 'function') {
                    callback();
                }
            });
        };

    recursive();
};

TemperatureMap.prototype.drawPoints = function (callback) {
    'use strict';
    var self = this,
        PI2 = 2 * Math.PI,
        ctx = this.ctx;
    window.requestAnimationFrame(function (timestamp) {
        var col = [],
            idx = 0,
            pnt;

        for (idx = 0; idx < self.points.length; idx = idx + 1) {
            pnt = self.points[idx];

            col = self.getColor(false, pnt.value);

            ctx.fillStyle = 'rgba(255, 255, 255, 128)';
            ctx.beginPath();
            ctx.arc(pnt.x, pnt.y, 8, 0, PI2, false);
            ctx.fill();

            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgb(' + col[0] + ', ' + col[1] + ', ' + col[2] + ')';
            ctx.beginPath();
            ctx.arc(pnt.x, pnt.y, 8, 0, PI2, false);
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgb(0, 0, 0)';
            ctx.fillText(Math.round(pnt.value), pnt.x, pnt.y);
        }

        if (typeof callback === 'function') {
            callback();
        }
    });
};
