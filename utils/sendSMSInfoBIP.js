var https = require('follow-redirects').https;
var fs = require('fs');

exports.sendSMSINFOBIP = function (number, body) {
    var options = {
        'method': 'POST',
        'hostname': '8kvymd.api.infobip.com',
        'path': '/sms/2/text/advanced',
        'headers': {
            'Authorization': `App ${process.env.SMS_AUTH_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        'maxRedirects': 20
    };
    
    var req = https.request(options, function (res) {
        var chunks = [];
    
        res.on("data", function (chunk) {
            chunks.push(chunk);
        });
    
        res.on("end", function (chunk) {
            var body = Buffer.concat(chunks);
            console.log(body.toString());
        });
    
        res.on("error", function (error) {
            console.error(error);
        });
    });
    
    var postData = JSON.stringify({
        "messages": [
            {
                "destinations": [{"to": number}],
                "from": "447491163443",
                "text": body
            }
        ]
    });
    
    req.write(postData);
    
    req.end();
}
