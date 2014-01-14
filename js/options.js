
function Options(opts) {
    // TODO -- refactor this to be a collection and each option an item...
    this.data = null
    this.app = opts && opts.app

    this.app_options = {
        'sync_torrents': {
            'default': false,
            'enabled':false,
            'type':'bool',
            'description': 'your list of torrents will be synchronized across your devices'
        },

        'spoof_utorrent': {
            'default':true,
            'type':'bool'
        },

        'show_notifications': {
            'default':true,
            'type':'bool'
        },

        'show_extension_notification': {
            'description': 'Whether to display a link to install the JSTorrent Helper Extension when adding a torrent',
            'default': true,
            'enabled': false,
            'type': 'bool',
        },

        'prevent_sleep': {
            'default': true,
            'type': 'bool'
        },

/*
// this is set as an attribute of the disks collection instead
        'default_download_location': {
            'default':null,
            'type':'JSON',
            'description':'where torrents download to'
        },
*/
        'new_torrent_show_dialog': {
            'default': false,
            'enabled': false,
            'type':'bool',
            'description':'whether to show a dialog when adding a new torrent'
        },

        'maxconns': {
            'default': 12,
            'type':'int'
        },

        'new_torrents_auto_start': {
            'default': true,
            'type': 'bool'
        },

        'report_anonymous_usage': {
            'default': true,
            'type': 'bool',
            'editable': false
        },

        'max_unflushed_piece_data': {
            //        'default': 16384 * 20, // needs to be much larger, or else we will get "stuck" a lot...
            'editable': false,
            'default': 16, // needs to be much larger, or else we will get "stuck" a lot...
            // i.e. store up to 4 complete pieces in RAM
            // this actually needs to be a multiple of each piece chunk size..
            'type': 'int'
        }
        
    }


}

jstorrent.Options = Options

Options.prototype = {
    get: function(k) {
        // gets from cached copy, so synchronous
        var val = this.data[k]
        if (val === undefined && this.app_options[k] && this.app_options[k]['default']) {
            return this.app_options[k]['default']
        } else {
            return val
        }
    },
    keys: function() {
        var data
        var a = []
        for (var key in this.app_options) {
            data = this.app_options[key]
            if (data.enabled === false || data.editable === false) {
                // dont show this option
            } else {
                a.push(key)
            }
        }
        a.sort()
        return a
    },
    getStorageKey: function() {
        var id = this.app.id
        return id + '/' + 'Options'
    },
    set: function(k,v) {
        // dont want to store these globally, but in the client namespace...

        this.data[k] = v
        var obj = {}

        var gobj = {}
        gobj[this.getStorageKey()] = this.data

        console.log('persisted option',k,v)
        chrome.storage.local.set(gobj)
    },
    load: function(callback) {
        chrome.storage.local.get(this.getStorageKey(), _.bind(this.options_loaded, this, callback))
    },
    options_loaded: function(callback, data) {
        console.log('options loaded',data);
        this.data = data[this.getStorageKey()]
        callback()
    },
    on_choose_download_directory: function(entry) {
        //var retain_string = chrome.fileSystem.retainEntry(entry);
        //console.log('user choose download directory',entry, 'retain string:',retain_string)
        /*
          this.set('default_download_location',
          {retainEntryId: retain_string,
          name: entry.name,
          fullPath: entry.fullPath}
          )
        */
        if (this.app) {
            this.app.set_default_download_location(entry)
        } else {
            //mainAppWindow.app.download_location = entry
            mainAppWindow.app.set_default_download_location(entry);
        }
    }
}


