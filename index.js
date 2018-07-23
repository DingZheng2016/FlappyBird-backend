const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const uuid = require('node-uuid');

const server = new https.createServer({
    cert: fs.readFileSync('./certificate/chained.pem'),
    key: fs.readFileSync('./certificate/domain.key')
});

const wss = new WebSocket.Server({ server });

let uuid_ws = {};
let not_matched = [];
let opponent = {};
let dead = {};
let gameOn = [];

wss.on('connection', function connection(ws){
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    ws.on('message', function incoming(message){
        let d = JSON.parse(message);
        console.log(d);
        if(d.type === 'request')
            deal_with_request(ws, d);
        else if(d.type === 'jump')
            deal_with_jump(ws, d);
        else if(d.type === 'score')
            deal_with_score(ws, d);
        else if(d.type === 'die')
            deal_with_die(ws, d);
        else if(d.type === 'connect')
            deal_with_connect(ws, d);
        else if(d.type === 'close')
            deal_with_close(ws, d);
        else if(d.type === 'delay')
            deal_with_delay(ws, d);
        else if(d.type === 'startbubble')
            deal_with_startbubble(ws, d);
        else if(d.type === 'endbubble')
            deal_with_endbubble(ws, d);
    });
});

function deal_with_request(ws, d){
    delete uuid_ws[d.uuid];
    ws.uuid = uuid.v4();
    ws.nickName = d.nickName;
    ws.avatarUrl = d.avatarUrl;
    ws.opponent = 'null';
    uuid_ws[ws.uuid] = ws;
    console.log(not_matched.length);
    while(not_matched.length > 0){
        let uuid = not_matched[0];
        if(!uuid_ws[uuid]){
            not_matched.shift();
            continue;
        }
        let res = {};
        res['type'] = 'matched';
        res['nickName'] = uuid_ws[uuid].nickName;
        res['avatarUrl'] = uuid_ws[uuid].avatarUrl;
        res['uuid'] = uuid;
        try{
            ws.send(JSON.stringify(res));
        }catch(e){
            console.log(e);
            break;
        }
        res['type'] = 'matched';
        res['nickName'] = ws.nickName;
        res['avatarUrl'] = ws.avatarUrl;
        res['uuid'] = ws.uuid;
        try{
            uuid_ws[uuid].send(JSON.stringify(res));
            not_matched.shift();
            console.log('not_matched: ' + not_matched.length);
            ws.opponent = uuid;
            uuid_ws[uuid].opponent = ws.uuid;
            opponent[uuid] = ws.uuid;
            opponent[ws.uuid] = uuid;
            gameOn[uuid] = true;
            gameOn[ws.uuid] = true;
            break;
        }catch(e){
            console.log(e);
            not_matched.shift();
            continue;
        }
    }
    console.log('_if: ' + not_matched.length);
    if(ws && ws.opponent === 'null')
        not_matched.push(ws.uuid);
    console.log('if_: ' + not_matched.length);
}

function deal_with_jump(ws, d){
    //uuid_ws[d.uuid] = ws;
    if(!(d.uuid in gameOn))
        return;
    gameOn[d.uuid] = true;
    let res = {};
    res['type'] = 'jump';
    res['posy'] = d.posy;
    try{
        uuid_ws[opponent[d.uuid]].send(JSON.stringify(res));
    }catch(e){
        console.log(e);
    }
}

function deal_with_connect(ws, d){
    if(d.uuid === '')
        return;
    ws.uuid = d.uuid;
    uuid_ws[d.uuid] = ws;
    dead[d.uuid] = false;
}

function deal_with_score(ws, d){
    if(!(d.uuid in gameOn))
        return;
    gameOn[d.uuid] = true;
    let res = {};
    res['type'] = 'score';
    res['score'] = d.score;
    try{
        uuid_ws[opponent[d.uuid]].send(JSON.stringify(res));
    }catch(e){
        console.log(e);
    }
}

function deal_with_die(ws, d){
    if(!(d.uuid in gameOn))
        return ;
    delete gameOn[d.uuid];
    dead[d.uuid] = true;
    console.log(d.uuid);
    let res = {};
    res['type'] = 'die';
    try{
        uuid_ws[opponent[d.uuid]].send(JSON.stringify(res));
    }catch(e){
        console.log(e);
    }
    if(dead[opponent[d.uuid]]){
        res['type'] = 'finish';
        try{
            ws.send(JSON.stringify(res));
            uuid_ws[opponent[d.uuid]].send(JSON.stringify(res));
        }catch(e){
            console.log(e);
        }
    }
}

function deal_with_startbubble(ws, d){
    if(!(d.uuid in gameOn))
        return ;
    gameOn[d.uuid] = true;
    let res = {};
    res['type'] = 'startbubble';
    try{
        uuid_ws[opponent[d.uuid]].send(JSON.stringify(res));
    }catch(e){
        console.log(e);
    }
}

function deal_with_endbubble(ws, d){
    if(!(d.uuid in gameOn))
        return ;
    gameOn[d.uuid] = true;
    let res = {};
    res['type'] = 'endbubble';
    try{
        uuid_ws[opponent[d.uuid]].send(JSON.stringify(res));
    }catch(e){
        console.log(e);
    }
}

function deal_with_close(ws, d){
    delete uuid_ws[ws.uuid];
    let i = not_matched.indexOf(ws.uuid);
    console.log('_not_matched: ' + not_matched);
    if(i > -1)
        not_matched.splice(i, 1);
    console.log('not_matched_: ' + not_matched);
    ws.terminate();
}

function deal_with_delay(ws, d){
    ws.send(JSON.stringify({type: 'delay', timestamp: d.timestamp}));
}

server.listen(443);

function noop() {}
 
function heartbeat() {
    this.isAlive = true;
}
/* 
wss.on('connection', function connection(ws) {
    ws.isAlive = true;
    ws.on('pong', heartbeat);
});
*/
const interval = setInterval(function ping() {
    for(let uuid in uuid_ws){
        if(uuid_ws[uuid].isAlive === false){
            console.log(uuid + ' terminated.');
            delete uuid_ws[uuid];
        }else{
            console.log('testing ' + uuid);
            uuid_ws[uuid].isAlive = false;
            uuid_ws[uuid].ping(noop);
        }
    }/*
    wss.clients.forEach(function each(ws) {
       if (ws.isAlive === false){
           console.log(ws.uuid + ' terminated.');
           return ws.terminate();
       }
       console.log('testing ' + ws.uuid);
       ws.isAlive = false;
       ws.ping(noop);
    });*/
}, 3000);

const offline = setInterval(function (){
    for(let uuid in gameOn){
        if(!gameOn[uuid]){
            delete gameOn[uuid];
            dead[uuid] = true;
            let res = {};
            res['type'] = 'die';
            try{
                uuid_ws[opponent[uuid]].send(JSON.stringify(res));
            }catch(e){
                console.log(e);
            }
            if(dead[opponent[uuid]]){
                res['type'] = 'finish';
                try{
                    uuid_ws[opponent[uuid]].send(JSON.stringify(res));
                }catch(e){
                    console.log(e);
                }
            }
        }
        else
            gameOn[uuid] = false;          
    }
}, 4000)
