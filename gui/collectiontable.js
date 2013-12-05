function SlickCollectionTable(opts) {
    this.collection = opts.collection
    this.domid = opts.domid
    this.columns = opts.columns
    this.formatters = opts.formatters

    var makeFormatter = {
        getFormatter: function(column) {
            return function(row,cell,val,col,data) {
                //console.log('called render on data',data, column.name)
                return data.get(column.id)
            }
        }
    }

    var options = {
        enableCellNavigation: true,
        enableColumnReorder: false,
        formatterFactory: makeFormatter
    };

    var collectiondata = this.collection.data()

    grid = new Slick.Grid("#" + this.domid, collectiondata, this.columns, options);
    grid.setSelectionModel(new Slick.RowSelectionModel());

    grid.onSelectedRowsChanged.subscribe( _.bind(function(evt, data) {
        var selected = data.rows;
	console.log('selection change',selected);

	//this.handle_selection_change(data.rows);

    },this));

    grid.onMouseEnter.subscribe(function (e) {
	var hash = {};
	var cols = grid.getColumns();

	hash[grid.getCellFromEvent(e).row] = {}
	for (var i = 0; i < cols.length; ++i) {
            hash[grid.getCellFromEvent(e).row][cols[i].id] = "hover";
	}
	grid.setCellCssStyles("hover", hash);
    });

    grid.onMouseLeave.subscribe(function (e) {
	grid.removeCellCssStyles("hover");
    });
    this.grid = grid

    this.collection.on('add', _.bind(this.on_add, this))
    this.collection.on('remove', _.bind(this.on_remove, this))
    this.collection.on('change', _.bind(this.on_change, this))
}

SlickCollectionTable.prototype = {
    single_selection_context: function(evt) {
	var rows = this.grid.getSelectedRows();
	if (rows.length > 0) {
	    return this.grid.getDataItem(rows[0]);
	}
    },
    handle_selection_change: function(rows) {
	var data = this.single_selection_context();
	if (! this.detailview) {
	    new InfoView({torrent:data})
	}
    },
    on_change: function(item, attr, p1,p2,p3) {
        console.log('collection item change',item,attr,p1,p2,p3)
        var idx = this.collection.indexOf( item.get_key() )
        //console.log('change at row',idx)
        this.grid.invalidateRow(idx)
        this.grid.render()
    },
    on_add: function(item) {
        console.log('collection onadd')
        this.grid.updateRowCount()
        this.grid.invalidateAllRows()
        this.grid.render()
    },
    on_remove: function(item) {
        console.log('collection onremove')
        this.grid.updateRowCount()
        this.grid.invalidateAllRows()
        this.grid.render()
    }
}