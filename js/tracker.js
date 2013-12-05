function Tracker(opts) {
    this.torrent = opts.torrent
    this.url = opts.url
    console.log("INIT TRACKER CLIENT W OPTS",opts)
    var parts = this.url.split('/')[2].split(':');
    this.scheme = this.url.split('/')[0].split(':')[0].toLowerCase();
    this.host = parts[0];
    this.port = parseInt(parts[1]);
    this.state = null;
    this.lasterror = null;
    this.connection = null;

    this.errors = 0
    this.responses = 0
    this.timeouts = 0
    this.announcing = false
    this.announce_callback = null
    this.announce_timeout = 3000;
    this.announce_timeout_hit = false
    this.announce_timeout_callback = null
}
jstorrent.Tracker = Tracker;

Tracker.prototype = {
    set_state: function(state) {
        if (state == 'error') {
            console.error('tracker',this.url,state, this.lasterror);
        } else {
            console.log('tracker',this.url,state, this.lasterror);
        }
        this.state = state;
    },
    announce: function(callback) {
        if (this.announcing) { return }
        this.lasterror = null
        this.announce_callback = callback
        this.announce_timeout_callback = setTimeout( _.bind(this.on_announce_timeout,this), this.announce_timeout )

	if (! this.connection) {
            this.set_state('get_connection')
	    this.get_connection( _.bind(function(connectionInfo, err) {
                if (err) {
                    this.set_error(err); return
                }
                this.connection = connectionInfo
                //console.log('tracker got connection',connectionInfo.connectionId)

                var announceRequest = this.get_announce_payload( connectionInfo.connectionId );
                this.set_state('write_announce')
                chrome.socket.write( connectionInfo.socketId, announceRequest.payload, _.bind( function(writeResult) {

                    this.set_state('read_announce')
                    // check error condition?
                    chrome.socket.read( connectionInfo.socketId, null, _.bind(this.on_announce_response, this, connectionInfo, announceRequest ) )
                }, this))



	    },this) );
	} else {
            this.set_error('re-using tracker udp connection not yet supported')
        }
    },
    set_error: function(err) {
        var callback = this.announce_callback
        if (this.announce_timeout_callback) { 
            clearTimeout( this.announce_timeout_callback );
            this.announce_timeout_callback = null
        }
        this.announce_callback = null
        this.errors++
        this.lasterror = err;
        this.set_state('error')
        if (callback) { callback(null, err) }
    },
    on_announce_timeout: function() {
        this.announce_timeout_callback = null
        this.announcing = false
        this.timeouts++
        this.set_error('timeout')
    },
    on_announce_response: function(connectionInfo, announceRequest, readResponse) {
        clearTimeout( this.announce_timeout_callback )
        var callback = this.announce_callback
        this.announce_callback = null
        this.announce_timeout_callback = null
        this.announcing = false
        this.responses++

        this.set_state('on_announce_response')
        var v = new DataView(readResponse.data);
        var resp = v.getUint32(4*0)
        var respTransactionId = v.getUint32(4*1);
        var respInterval = v.getUint32(4*2);
        var leechers = v.getUint32(4*3);
        var seeders = v.getUint32(4*4);

        console.assert( respTransactionId == announceRequest.transactionId )

        var countPeers = (readResponse.data.byteLength - 20)/6
        console.log('announce says leechers',leechers,'seeders',seeders,'interval',respInterval, 'peers',countPeers)

        for (var i=0; i<countPeers; i++) {
            var ipbytes = [v.getUint8( 20 + (i*6) ),
                      v.getUint8( 20 + (i*6) + 1),
                      v.getUint8( 20 + (i*6) + 2),
                      v.getUint8( 20 + (i*6) + 3)]
            var port = v.getUint16( 20 + (i*6) + 4 )
            var ip = ipbytes.join('.')
            //console.log('got peer',ip,port)
            //this.torrent.swarm.add_peer( { ip:ip, port:port } )
            var peer = new jstorrent.Peer({torrent: this.torrent, host:ip, port:port})
            this.torrent.swarm.add( peer )
        }
        this.torrent.set('numswarm', this.torrent.swarm.length )

        if (callback) { callback(countPeers) }
    }
}

function HTTPTracker() {
    Tracker.apply(this, arguments)
}

jstorrent.HTTPTracker = HTTPTracker;
for (var method in Tracker.prototype) {
    jstorrent.HTTPTracker.prototype[method] = Tracker.prototype[method]
}

function UDPTracker() {
    Tracker.apply(this, arguments)
}



UDPTracker.prototype = {
    get_announce_payload: function(connectionId) {
        var transactionId = Math.floor(Math.random() * Math.pow(2,32))
        var payload = new Uint8Array([
            0,0,0,0, 0,0,0,0, /* connection id */
            0,0,0,1, /* action */
            0,0,0,0, /* transaction id */
            0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0, /* infohash */
            0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0, /* peer id */
            0,0,0,0,0,0,0,0, /* downloaded */
            0,0,0,0,0,0,0,0, /* left */
            0,0,0,0,0,0,0,0, /* uploaded */
            0,0,0,0, /* event */
            0,0,0,0, /* ip */
            0,0,0,0, /* key */
            255,255,255,255, /* numwant */
            2,0, /* port */
            0,0, /* extensions */
        ]);

        var v = new DataView( payload.buffer );
        v.setUint32( 0, connectionId[0] )
        v.setUint32( 4, connectionId[1] )
        v.setUint32( 12, transactionId )
        for (var i=0; i<20; i++) {
            v.setInt8(16+i, this.torrent.hashbytes[i])
        }
        for (var i=0; i<20; i++) {
            v.setInt8(16+i, this.torrent.hashbytes[i])
        }
        for (var i=0; i<20; i++) {
            v.setInt8(36+i, this.torrent.client.peeridbytes[i])
        }
        return {payload: payload.buffer, transactionId: transactionId};
    },
    get_connection_data: function() {
	// bittorrent udp protocol connection header info
        var payload = new Uint8Array([0, 0, 4, 23, 39, 16, 25, 128, /* hard coded protocol id */
                                      0,0,0,0, /* action */
                                      0,0,0,0 /* transaction id */
                                     ]);
        var action = 0
        var transaction_id = Math.floor(Math.random() * Math.pow(2,32))
        var v = new DataView(payload.buffer)
        v.setUint32(8, action);
        v.setUint32(12, transaction_id)
        return {payload:payload.buffer, transaction_id:transaction_id}
    },
    get_connection: function(callback) {
        chrome.socket.create('udp', {}, _.bind(function(sockInfo) {
            var sockId = sockInfo.socketId
            chrome.socket.connect( sockId, this.host, this.port, _.bind( function(sockConnectResult) {

                var connRequest = this.get_connection_data();
                chrome.socket.write( sockId, connRequest.payload, _.bind( function(sockWriteResult) {

                    chrome.socket.read( sockId, null, _.bind( function(sockReadResult) {

                        //console.log('udp get connection response',sockReadResult, 'len',sockReadResult.data.byteLength)

                        if (sockReadResult.data.byteLength < 16) {
                            callback( null, {error:'error udp connection response', result: sockReadResult } )
                        } else {

                            var resp = new DataView( sockReadResult.data );
                            var respAction = resp.getUint32(0);
                            var respTransactionId = resp.getUint32(4)
                            var connectionId = [resp.getUint32(8), resp.getUint32(12)]

                            console.assert( connRequest.transaction_id == respTransactionId );
                            callback( {connectionId:connectionId, socketId:sockInfo.socketId}, null )
                        }

                    }, this));

                }, this));

            }, this));
        },this));
    }
}



jstorrent.UDPTracker = UDPTracker;
for (var method in Tracker.prototype) {
    jstorrent.UDPTracker.prototype[method] = Tracker.prototype[method]
}

