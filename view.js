let v_this = undefined;

class View
{
    constructor()
    {
        v_this = this;

		//Constants
        this.MainPlaybackLine = null;
        this.RestartPlaybackLine = null;
		this.Maingrid = null;
        this.GridboxContainer = null;
        this.GridArray = null;
        this.console = null;
        this.MaximumPitch = 12*8;
        this.selectP = { x: 0, y: 0};

		//Restorable state information
        this._PixelsPerTick = 20;
		this._GridWidthTicks = 512;

        // this.IntervalColors =
        // [
        //     'olive', //octave or unison
        //     'red', //minor second
        //     'maroon', //major second
        //     'cyan', //minor third
        //     'blue', //major third
        //     'blue', //perfect fourth
        //     'magenta', //tritone
        //     'gold', //perfect fifth
        //     'green', //minor sixth
        //     'darkgreen', //major sixth
        //     'red', //minor seventh
        //     'darkred', //major seventh
        // ];

        this.IntervalColors =
        [
            'white', //octave or unison
            'red', //minor second
            'red', //major second
            'green', //minor third
            'green', //major third
            'purple', //perfect fourth
            'red', //tritone
            'blue', //perfect fifth
            'green', //minor sixth
            'green', //major sixth
            'red', //minor seventh
            'red', //major seventh
        ];

        this.colorKey =
        [
            'red', //C
            'palevioletred', //
            'yellow', //D
            'mediumvioletred', //
            'lightblue', //E
            'maroon', //F
            'royalblue', //
            'darkorange', //G
            'mediumorchid', //
            'limegreen', //A
            'brown', //
            'cornflowerblue', //B
        ];

        this.TrackColors =
        [
            'black', //track 1
            'darkgoldenrod', //track 2
            'purple', //track 3
            'red', //track 4
            'green', //track 5
            'deepPink', //track 6
            'white', //track 7
            'purple', //track 8
            'dimgray', //track 9
            'red', //track 10
        ];
    }

	copyIfValid(x, defaultValue)
	{
		return isNaN(x) ? defaultValue : x;
	}

    Initialize(
        //control
		initializationParameters,controller,
        //kb
        onKeyPress,
        //mouse
        onMouseScroll, onMouseMove, onMouseClickUp, onMouseClickDown,onHoverBegin, onHoverEnd,
        //page UI
        onSliderChange,
        onTrackSliderChange,onTrackSelectChange,onTrackButton,
        onPageUnload,radioButtonHandler,
		onGridClick)
    {
        this.Maingrid = $("#gridbox");
        this.GridboxContainer = $("#gridboxContainer");
        this.GridArray = $("#GridboxArray");
        this.MainPlaybackLine =$("#MainPlaybackLine");
        this.RestartPlaybackLine =$("#RestartPlaybackLine");

		//Restore state
		if(initializationParameters != null)
		{
			this.PixelsPerTick = this.copyIfValid(initializationParameters.PixelsPerTick, 20);
			this.GridWidthTicks = this.copyIfValid(initializationParameters.GridWidthTicks, 512);
			this.GridboxContainer.scrollTop(initializationParameters.ScrollLeft);
			this.GridboxContainer.scrollLeft(initializationParameters.ScrollTop);
			console.log(initializationParameters)
		}
		else
		{
			this.PixelsPerTick = 20;
		}

		//Bind handlers
    	this.Maingrid
            .mousemove(this.OnMouseMove)
            .mousedown(onMouseClickDown)
            .mouseup(onMouseClickUp)
            .mouseenter(onHoverBegin)
            .mouseleave(onHoverEnd)
            .on("contextmenu",function(){
                //No right clicking
               return false;
            });

        $('input[type=radio]').change(this.OnRadioButton);

        $(document).keydown(onKeyPress);
        $(document).keyup(onKeyPress);
        this.GridMouseHandler = onMouseMove;
        this.RadioButtonHandler = radioButtonHandler;
        this.SliderHandler = onSliderChange;
        this.SelectHandler = onTrackSelectChange;
        this.OnTrackButton = onTrackButton;
		this.OnGridClick = onGridClick

        $(document).on('input change', '#TempoSlider',this.OnSliderChange);
        $(document).on('input change', '.volumeSlider',this.OnSliderChange);
        $(document).on('select change', '.InstrumentSelector', this.OnSelectChange);
		
		$(document).on("click", ".gridCanvas", function(e)
		{
			v_this.OnGridClick(parseInt(this.attributes.gridindex.value));
		});
		
        //$('select').on('change', function() {alert( this.value );});

        //$(document).on('select change', this.OnSelectChange);

        $(document).on('input[type=checkbox] change', '.trackrow',this.OnTrackButton);
        $(window).on('beforeunload', function ()
        {
            return onPageUnload();
            return true;
        });

        this.Maingrid.bind('mousewheel DOMMouseScroll', onMouseScroll);

        //$("#trackbox select").change();
        //$("#trackbox input").change();
    }

	Serialize()
	{
		var serializedData =
		{
			PixelsPerTick: this._PixelsPerTick,
			GridWidthTicks: this._GridWidthTicks,
			ScrollLeft: this.GridboxContainer.scrollTop(),
			ScrollTop: this.GridboxContainer.scrollLeft(),
		};

		return JSON.stringify(serializedData);
	}

    OnSelectChange(event)
    {
        console.log(this,event)
        v_this.SelectHandler(this.value,event);
        $('select').blur();
        //v_this.Maingrid.focus();
    }

    OnSliderChange()
    {
        var tempo = $("#TempoSlider").val();
        $("#TempoPreview").text("Tempo: "+tempo);
        v_this.SliderHandler(tempo);
    }

    PopulateSelectMenu(selectEntryCodes)
    {
        var $dropdown = $(".InstrumentSelector");
        selectEntryCodes.forEach(function(entry)
        {
            $dropdown.append($("<option />").val(entry).text(entry));
        });
    }

    set PixelsPerTick(pixelsPerTick)
    {
        this._PixelsPerTick = pixelsPerTick;
        var maximumPitchRange = this.MaximumPitch;
        var mainGridHeight = pixelsPerTick*maximumPitchRange;
        var gridboxContainerHeight = 600;

        //Gridbox container should be smaller than gridbox
        //Gridbox container should be
        if(gridboxContainerHeight > mainGridHeight)
        {
            gridboxContainerHeight = mainGridHeight+20;
        };

        this.GridboxContainer.css({
            'height':gridboxContainerHeight,
        })

		//Re-assign to gridWidthTicks to call handler (TODO this is sloppy)
        this.GridWidthTicks = this._GridWidthTicks;

    }

    get PixelsPerTick()
    {
        return this._PixelsPerTick;
    }

    set GridWidthTicks(ticks)
    {
        var pixelsPerTick = this.PixelsPerTick;
        var maximumPitchRange = this.MaximumPitch;
        var mainGridHeight = pixelsPerTick*maximumPitchRange;
		this._GridWidthTicks = ticks

        this.Maingrid.css({
            'height':mainGridHeight,
            'width':pixelsPerTick*ticks,
        });

    }

	get GridWidthTicks()
	{
		return this._GridWidthTicks
	}

	get MinimumPitch()
	{
		// var mainGridHeight = this.Maingrid.height();
		// return mainGridHeight*pixelsPerTick;

		return 0;
	}

    OnRadioButton(event)
    {
        var eventData = v_this.GetFormData();

        v_this.RadioButtonHandler(eventData);
    }

    GetFormData()
    {
        var filter = $('input:checked');
        var identifier = filter.parent().parent().parent().attr("id");
        var eventData = []

        filter.each(function()
        {
            var identifier = $(this).parent().parent().parent().attr("id");
            eventData.push({id:identifier, value:this.value});
        });

        return eventData;
    }

    OnMouseMove(event)
    {
        var cursorPosition = { x: -1, y: -1 };
        var offset = v_this.Maingrid.offset();
        var gridSnap = v_this.PixelsPerTick;

        cursorPosition.x = (Math.ceil((event.pageX - offset.left) / gridSnap)*gridSnap)-gridSnap;
        cursorPosition.y = (Math.ceil(((event.pageY - offset.top)) / gridSnap)*gridSnap)-gridSnap;

        // cursorPosition.x = (Math.ceil((event.pageX - offset.left) / gridSnap))-1;
        // cursorPosition.y = (Math.ceil(((event.pageY - offset.top)) / gridSnap))-1;

        v_this.GridMouseHandler(cursorPosition);
    }

    ConvertPitchToYIndex(pitch)
    {
        var pitchOffset = this.MaximumPitch - pitch;
		var mainGridHeight = this.Maingrid.height();

        var result = (this.PixelsPerTick*pitchOffset) % mainGridHeight;
        return result;
    }

    ConvertTicksToXIndex(ticks)
    {
        return this.PixelsPerTick*ticks;
    }

    ConvertYIndexToPitch(yIndex)
    {
        return this.MaximumPitch - (yIndex/this.PixelsPerTick);
    }

    ConvertXIndexToTicks(xIndex)
    {
        return xIndex/this.PixelsPerTick;
    }

    GetColorKey(pitch)
    {
        var colorIndex = pitch % 12;
        return this.colorKey[colorIndex];
    }

    DeleteSelectRectangle()
    {
        $(".selectionRectangle").remove();
    }

    ScrollToPitchTickCenter(ticks, pitch)
    {
        var gridContainer = this.GridboxContainer;

        var gridContainerWidthHalf = gridContainer.width()/2;
        var gridContainerHeightHalf = gridContainer.height()/2;

        var newXCenter =  this.ConvertTicksToXIndex(ticks);
        var newYCenter = this.ConvertPitchToYIndex(pitch);

        var leftOffset =  newXCenter - gridContainerWidthHalf;
        var topOffset = newYCenter - gridContainerHeightHalf;

        this.GridboxContainer.scrollTop(topOffset);
        this.GridboxContainer.scrollLeft(leftOffset);
    }

	ScrollVertical(yOffset)
	{
        var mainDiv = this.GridboxContainer;

		var currentScroll = mainDiv.scrollTop();
        var newOffset = currentScroll+yOffset;
		var gridSnap = this.PixelsPerTick;
        mainDiv.scrollTop(newOffset);

		var newScrollPosition = mainDiv.scrollTop();
		var actualOffset = newScrollPosition - currentScroll;
		if(actualOffset > 0)
        {
			actualOffset = Math.ceil(actualOffset/gridSnap) * gridSnap;
		}
        else if( actualOffset < 0)
		{
            actualOffset = Math.floor(actualOffset/gridSnap) * gridSnap;
        }
		return actualOffset;
	}

    ScrollHorizontal(xOffset)
    {
        var mainDiv = this.GridboxContainer;

		var currentScroll = mainDiv.scrollLeft();
        var newOffset = currentScroll+xOffset;
		var gridSnap = this.PixelsPerTick;
        mainDiv.scrollLeft(newOffset);

		var newScrollPosition = mainDiv.scrollLeft();
		var actualOffset = newScrollPosition - currentScroll;
		if(actualOffset > 0)
		{
			actualOffset = Math.ceil(actualOffset/gridSnap) * gridSnap;
		}
		else if( actualOffset < 0)
		{
			actualOffset = Math.floor(actualOffset/gridSnap) * gridSnap;
		}

		return actualOffset;
    }

    ScrollDelegate()
    {
        var shouldScroll = false;
        var x = this.GridboxContainer.scrollLeft();
        var y = this.GridboxContainer.scrollTop();

        if(this.XTickCount > 0)
        {
            x += this.PixelsPerTick/2;
            this.XTickCount--;
            shouldScroll = true;
        }

        if(this.PositiveYTickCount > 0)
        {
            y += this.PixelsPerTick/2;
            this.PositiveYTickCount--;
            shouldScroll = true;
        }

        else if(this.NegativeYTickCount > 0)
        {
            y -= this.PixelsPerTick/2;
            this.NegativeYTickCount--;
            shouldScroll = true;
        }

        if(shouldScroll)
        {
            this.GridboxContainer.scrollLeft(x); // horizontal and vertical scroll increments
            this.GridboxContainer.scrollTop(y); // horizontal and vertical scroll increments

            this.PendingTimeout = setTimeout(
                $.proxy(this.ScrollDelegate, this), this.MillisecondsPerTick);
        }
    }

    SmoothScroll(xCoordinate, yCoordinate)
    {
        var mainDiv = this.GridboxContainer;
        var gridWidth = mainDiv.width();

        var halfGridWidth = gridWidth/2;
        var xAdjustedCoordinate = xCoordinate - halfGridWidth;

        this.ResetAutoScroll();

		var gridHeight = mainDiv.height();
		var halfGridheight = gridHeight/2;
		var yAdjustedCoordinate = yCoordinate - halfGridheight;

		mainDiv.animate({scrollTop:yAdjustedCoordinate, scrollLeft:xAdjustedCoordinate},500);

    }

    ResetAutoScroll()
    {
        clearTimeout(this.PendingTimeout);
        //this.GridboxContainer.stop();
        this.XTickCount = 0;
        this.NegativeYTickCount = 0;
        this.PositiveYTickCount = 0;
        this.MillisecondsPerTick = 0;
    }

    AutoScroll(xStart, yStart, xDestination, yDestination, millisecondsPerTick)
    {
        var gridContainer = this.GridboxContainer;

        var halfGridWidth = gridContainer.width()/2;
        var halfGridHeight = gridContainer.height()/2;
        var yAxisHysteresis = halfGridHeight;
        var currentScrollTop = gridContainer.scrollTop();

        var xAdjustedCoordinate = xDestination;
        var yAdjustedCoordinate = yDestination - halfGridHeight;
        this.ResetAutoScroll();

        this.MillisecondsPerTick = millisecondsPerTick/2;
        this.XTickCount = 2*(xAdjustedCoordinate - xStart)/(this.PixelsPerTick);

        var yPixelDifference = (yAdjustedCoordinate - currentScrollTop);

        if(Math.abs(yPixelDifference) > yAxisHysteresis)
        {
            var yTicks = 2*yPixelDifference/(this.PixelsPerTick);

            if(yTicks < 0)
            {
                this.NegativeYTickCount = -yTicks;
            }

            else
            {
                this.PositiveYTickCount = yTicks;
            }
        }

        this.ScrollDelegate();
    }

    GetGridboxThumbnail(instance, imageCallback, index)
    {
        var x = this.GridboxContainer[0]

        html2canvas(x, {logging:false}).then(function(img)
        {
            var eventData = {Image: img, GridIndex: index};
            imageCallback.call(instance, eventData)
        });
    }

    RenderGridArray(gridImages, selectedIndex)
    {
		//TODO: make this more efficient, do not re-render everything
        var numberOfEntries = gridImages.length;
        var domGridArray = this.GridArray;
        domGridArray.empty();
        var nodeIndex = 0;

        while(nodeIndex < numberOfEntries)
        {
            var image = gridImages[nodeIndex];
            var canvasNode = $('<canvas/>');
            canvasNode.addClass("gridCanvas").attr("gridIndex", nodeIndex);
            domGridArray.append(canvasNode);

            if(nodeIndex == selectedIndex)
            {
                canvasNode.css({'border':'solid purple 3px'});
            }
            else 
			{
                canvasNode.css({'border':'solid black 1px'});
            }

            try {
                if(image != null)
                {
                    //var dataurl = image.toDataURL()
                    var context = canvasNode[0].getContext("2d");
                    var cWidth = canvasNode.width()*2;
                    var cHeight = canvasNode.height()*2;
                    context.drawImage(image, 0, 0, cWidth,cHeight);
                }
            } catch (e) {
                console.log(e);
            } finally {

                nodeIndex++;
            }
        }
    }

    RenderSelectRectangle(selectPosition, cursorPosition)
    {
        var node = document.createElement('div');
        $(node).addClass("selectionRectangle");

        var x_offset = 0;
        var y_offset = 0;

        var rect_width = (cursorPosition.x - selectPosition.x);
        var rect_height = (cursorPosition.y - selectPosition.y);

        if(rect_width < 0)
        {
            rect_width *= -1;
            x_offset = rect_width;
        }

        if(rect_height < 0)
        {
            rect_height *= -1;
            y_offset = rect_height;
        }

        var top = selectPosition.y-y_offset;
        var left = selectPosition.x-x_offset;

        $(node).css({
			'top':top,
			'left':left,
			'border':'solid black 1px',
			'position':'absolute',
			'width':rect_width,
			'height':rect_height
		});

		this.DeleteSelectRectangle();
        this.Maingrid.append(node);
    }

	RenderKeys(modeArray, cursorX, cursorY)
	{
        var keyNoteClass = "keynote";
		var mainGridWidth = this.Maingrid.width();
		var mainGridHeight = this.Maingrid.height();
        var maximumPitch = this.MaximumPitch;
        $(".keynote").remove();

        function functionRenderKeyRow(offsetY, colorIndex, noteOpacity,cursorX, cursorY)
        {
            var node = document.createElement('div');

            // if(Math.abs(cursorY - offsetY) > v_this.PixelsPerTick*3)
            // {
            //     $(node).addClass("keynote");
            // }
            // else {
            //     $(node).addClass("keynote2");
            // }
            colorIndex = 'white';
            $(node).addClass("keynote");
            $(node).css({
				'background':colorIndex,
				'top':offsetY,
				"opacity":noteOpacity,
				"height":v_this.PixelsPerTick,
                "left":0,
                "z-index":2,
                "border-bottom":'solid black 2px',
                "position":"absolute",
				"width":mainGridWidth

            });

            v_this.Maingrid.append(node);
        }

		//Color all octaves of a given note in each iteration.
		modeArray.some(function(modeSlot)
		{
			const pitch = modeSlot.Pitch;
			const colorIndex = this.GetColorKey(pitch);

            const incrementOffset = 12 * this.PixelsPerTick;
			const noteOpacity = modeSlot.Opacity;
            const keyOffsetY = this.ConvertPitchToYIndex(pitch);

            var lowerOffset = keyOffsetY - incrementOffset;
            var upperOffset = keyOffsetY + incrementOffset;



            functionRenderKeyRow(keyOffsetY, colorIndex, noteOpacity,cursorX, cursorY);
            while(lowerOffset >= 0)
            {
                functionRenderKeyRow(lowerOffset, colorIndex, noteOpacity,cursorX, cursorY);
                lowerOffset -= incrementOffset;
            }
            while (upperOffset < mainGridHeight)
            {
                functionRenderKeyRow(upperOffset, colorIndex, noteOpacity,cursorX, cursorY);
                upperOffset += incrementOffset;
            }

		}, this);
	}

    RenderPlaybackLine(mainPlaybackCursorStartTicks, restartPlaybackCursorStartTicks)
    {
        var mainPlaybackXCoordinate = this.ConvertTicksToXIndex(mainPlaybackCursorStartTicks);
        var restartPlaybackXCoordinate = this.ConvertTicksToXIndex(restartPlaybackCursorStartTicks);

        this.MainPlaybackLine.css({'left':mainPlaybackXCoordinate})
        this.RestartPlaybackLine.css({'left':restartPlaybackXCoordinate})
    }

    //Apply style to an existing note
    ApplyNoteStyle(note, keyColoration=true)
    {
        var node = note.JqueryKey;
        var noteWidth = note.Duration*this.PixelsPerTick;
        var pitch = note.Pitch;
        var noteOpacity = 1.0;

        var noteGridStartTimeTicks = note.StartTimeTicks;
        var offsetY = this.ConvertPitchToYIndex(pitch);
        var offsetX = this.ConvertTicksToXIndex(noteGridStartTimeTicks);
        var colorIndex = undefined;
        var borderColor = '';

        //TODO: neaten this part
        if(note.IsHighlighted)
        {
            colorIndex = 'white';
        }
        //Key coloration
        else if(!keyColoration)
        {
            colorIndex = this.GetColorKey(pitch);
        }

        //Track coloration
        else
        {
            var trackNumber = note.CurrentTrack;
            colorIndex = this.TrackColors[trackNumber];
        }

        if(note.IsSelected)
        {
            noteOpacity = 0.5;
        }

        if(note.BassInterval !== undefined)
        {
            borderColor = '0px 0px 10px 5px ' + this.IntervalColors[note.BassInterval];
        }

        $(node).css({
            'background':colorIndex,
            'border':'solid gray 1px',
            'box-shadow': borderColor,
            'top':offsetY,
            'left':offsetX,
            'opacity':noteOpacity,
            'height':this.PixelsPerTick,
            'width':noteWidth,
            'position':'absolute'
        });
    }


    //Apply style to existing notes from an array
    UpdateExistingNotes(noteArray, noteColorationMode)
    {
        noteArray.forEach(function(note)
		{
            this.ApplyNoteStyle(note, noteColorationMode);

		},this);
    }

    //Add notes to the DOM and apply style to them
    InstantiateNotes(noteArray, noteColorationMode)
    {
        var gridNoteClass = "gridNote";
        var mainGrid = this.Maingrid;
        noteArray.forEach(function(note)
        {
			var node = document.createElement('div');
            note.JqueryKey = node;
            $(node).addClass(gridNoteClass);
            this.ApplyNoteStyle(note, noteColorationMode);
			mainGrid.append(node);
        },this);
    }

    //Delete notes from the DOM
    DeleteNotes(noteArray)
    {
        noteArray.forEach(function(note)
        {
            note.JqueryKey.remove();
        },this);
    }
    SetBorderColor(color)
    {
        var borderCssString = 'solid '+color+' 3px';
        this.GridboxContainer.css('border',borderCssString);
    }

    //Handle deletions and additions and reset jquery assignments
    RenderNotes(noteArray, noteColorationMode)
    {
        var mainGrid = this.Maingrid;
        $(".gridNote").remove();
        this.InstantiateNotes(noteArray, noteColorationMode);
	}
}
