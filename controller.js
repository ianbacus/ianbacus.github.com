var sm = {
    BEGIN: 1,
    SELECTED: 2,
    DRAG: 3
};

var PlaybackEnumeration = {
    RestartFromBeginning:0,
    RestartFromLastStart:1,
    Resume:2,
}

var editModeEnumeration = {
	EDIT: 0,
	SELECT: 1,
    MidiControllerMode: 2,
    InstantMidiControllerMode:3,
	DELETE: 4,
}

var Modes =
[
    [2,1,2,2,2,1,1,1], //minor
    [2,2,1,2,2,2,1], //major
];

let c_this = undefined;

class Track
{
    constructor()
    {
        //this.Instrument = m_this.InstrumentEnum[m_this.InstrumentEnum.flute];
        this._Instrument = "guitar";
        //this.Instrument = m_this.InstrumentEnum.flute;
        this.Volume = 0;
        this.Index = 0;
        this.Muted = false;
        this.Selectable = true;
    }

    get Instrument()
    {
        return this._Instrument;
    }

    set Instrument(instrument)
    {
        this._Instrument = instrument;
    }

};

class Controller
{
    constructor(view, model)
    {
		//Member objects
        c_this = this;
        this.console = null;
        this.View = view;
        this.Model = model;

		//lookup tables
        this.EditModeColors = ['orange','blue','cyan','green'];
        this.InvertibleCounterpointIntervals =
        [
			// 12, //free: everything goes down an octave
			// 12, //15th: a perfect octave
			// 7,  //12th: a fifth
			// 4, //10th: a 3rd (3 or 4?)

            function(interval) {return undefined;},
            function(interval) {return (12 - (interval%12))%12;}, //Fifteenth:
            function(interval) {return (19 - (interval%12))%12;}, //Twelfth:
            function(interval) {return (15 - (interval%12))%12;}, //Tenth:
        ];

		//Session state data
        this.Playing = false;
        this.PendingTimeout = null;
        this.SequenceNumber = 0;
        this.NoteIndex = 0;
        this.MainPlaybackStartTicks = 0;
        this.CapturedPlaybackStartTicks = 0;
        this.Hovering = false;
        this.SelectingGroup = false;
        this.CursorPosition = { x: -1, y: -1 };
        this.SelectorPosition = { x: -1, y: -1 };
        this.DefaultNoteDuration = 4;
        this.PasteBuffer = []
        this.MidiControllerInstantChordNotes = []

        this.MillisecondsPerTick = 100;
        this.IntervalTranslator = this.InvertibleCounterpointIntervals[0];
		this.CurrentInstrument = null;
        this.Tracks = [];
        //this.Tracks.fill(new Track(),0,9);

		//Recoverable state data
        this.TonicKey = 0;
        this.MusicalModeIndex = 0;
        this._CurrentTrack = 0;
		this.NoteColorationMode = false;
        this.EditorMode = editModeEnumeration.EDIT;


    }

    InitializeInstrumentSelectors()
    {
        var instrumentOptions = [];
        var instrumentEnumeration = this.Model.InstrumentEnum;
        this.CurrentInstrument = instrumentEnumeration.flute;//Object.keys(instrumentEnumeration)[0];

        Object.keys(instrumentEnumeration).forEach(function(key) { instrumentOptions.push(key); });
        this.View.PopulateSelectMenu(instrumentOptions);
    }

    Initialize(initializationParameters)
    {
        //Load saved settings
//        this.console.log("init controller",initializationParameters)//todo removed log


        this.InitializeInstrumentSelectors();
        this.CurrentTrack = 0;

		if(initializationParameters != null)
		{
            function copyOrSetDefault(copyValue,defaultValue)
            {
                if(copyValue === undefined)
                {
                    return defaultValue;
                }
                else
                {
                    return copyValue;
                }
            }

			this.TonicKey = copyOrSetDefault(initializationParameters.TonicKey, 0);
			this.MusicalModeIndex = copyOrSetDefault(initializationParameters.MusicalModeIndex, 0);
			this.CurrentTrack = copyOrSetDefault(initializationParameters.CurrentTrack, 0);
			this.NoteColorationMode = copyOrSetDefault(initializationParameters.NoteColorationMode, false);
			this.EditorMode = copyOrSetDefault(initializationParameters.EditorMode, editModeEnumeration.EDIT);
            this.Tracks = copyOrSetDefault(initializationParameters.Tracks, []);
		}
        //Make sure there are at least 10 tracks
        for(var i = 0; i<10; i++)
        {
           this.AddTrack(i);
        }

        //Instruments
        this.InitializeInstrumentSelectors()

        //Analysis
        var analysisOption = this.GetModeSettings().AnalysisMode;
        this.IntervalTranslator = this.InvertibleCounterpointIntervals[analysisOption];
        this.InitializeMidiController()

        //Main windows
        this.RefreshGridPreview();
        this.SetKeyReference(this.TonicKey, this.MusicalModeIndex);

        var editModeColor = this.EditModeColors[this.EditorMode];
        this.View.SetBorderColor(editModeColor);
    }

	Serialize()
	{
        //Save the current settings into a JSON object to pass back to initialize later
		var serializedData =
		{
			TonicKey: this.TonicKey,
			MusicalModeIndex: this.MusicalModeIndex,
			CurrentTrack: this.CurrentTrack,
			NoteColorationMode: this.NoteColorationMode,
			EditorMode: this.EditorMode,
            Tracks: this.Tracks,
		}

		return JSON.stringify(serializedData);
	}

    SetTrackVolume(trackNumber, volume)
    {
        this.Tracks[trackNumber].Volume = volume
    }
    GetTrackVolume(trackNumber, volume)
    {
    }

    SetTrackAttribute(trackNumber, attribute, value)
    {
        console.log(attribute + " track " + trackNumber + "?" + value);
        if(attribute == "Mute")
        {
            this.Tracks[trackNumber].Muted = value;
        }
        else if(attribute == "Lock")
        {
            this.Tracks[trackNumber].Locked = value;
        }

    }

    SetTrackInstrument(trackNumber,instrumentCode)
    {
        if(instrumentCode == "")
        {
            instrumentCode = 'guitar';
        }
        this.Tracks[trackNumber].Instrument = instrumentCode;// m_this.InstrumentEnum[instrumentCode];
    }
    GetTrackInstrument(trackNumber)
    {
        var instrumentCode = c_this.Tracks[trackNumber]._Instrument;
        var instrument = m_this.InstrumentEnum[instrumentCode];
        //console.log(instrument, this.Tracks);
        return instrument
    }

	OnTrackSliderChange(eventData)
	{
		trackIndex = 0;
		m_this.Track[trackIndex].Volume = eventData;
	}

	OnTrackSelectChange(instrumentCode, eventData)
	{
        var trackIndex = parseInt(eventData.target.parentElement.attributes["value"].value);
//            this.console.log(eventData.target, trackIndex, instrumentCode);//todo removed log
        c_this.SetTrackInstrument(trackIndex, instrumentCode);
		//m_this.Track[trackIndex].InstrumentEnum[instrumentCode];
        //console.log("Track " + trackIndex + " instrument change", instrumentCode, eventData);
	}

	OnTrackButton(eventData)
	{
        eventData.preventDefault();
        try {
            var value = $(this).attr("value");
            var state = $(this).attr("state");

            if(state == 0)
            {
                $(this).css({'background':'red'});
                $(this).attr("state",1);
            }
            else
            {
                $(this).css({'background':'white'});
                $(this).attr("state",0);
            }

            var trackIndex = $(this).parent().attr("value");

    		//var trackIndex = parseInt(eventData.currentTarget.attributes["value"].value);
            var buttonIndex = eventData.target.attributes["value"].value;
            var buttonStatus = eventData.target.checked

            c_this.SetTrackAttribute(trackIndex,buttonIndex,(state==0));

        } catch (e) {
            console.log(e)
        }
	}

    OnSelectChange(instrumentCode,eventData)
    {
        c_this.CurrentInstrument = m_this.InstrumentEnum[instrumentCode];
    }

    OnThumbnailRender(eventData)
    {
        var image = eventData.Image;
        var index = eventData.GridIndex;

        c_this.Model.GridImageList[index] = image;
        c_this.View.RenderGridArray(c_this.Model.GridImageList, index);
    }

    SetKeyReference(tonic, modeIndex)
    {
        var tonicOpacity = 0.25;
        var dominantOpacity = 0.20;

		var modeBuffer = [{Pitch:tonic, Opacity: tonicOpacity}];
        var currentTone = tonic;
        var intervals = Modes[modeIndex]

		intervals.some(function(interval)
		{
            var noteOpacity = 0.15;
            currentTone += interval;
            var relativeInterval = Math.abs(currentTone - tonic)

            //Dominant
            if(relativeInterval === 7)
            {
                noteOpacity = dominantOpacity;
            }

            var modeSlot = {Pitch:currentTone, Opacity: noteOpacity};
            modeBuffer.push(modeSlot);
		});

//        this.console.log("Render keys in set key reference");//todo removed log
		this.View.RenderKeys(modeBuffer, this.CursorPosition.x, this.CursorPosition.y);
    }

    RefreshNotesAndKey()
    {
        this.SetKeyReference(this.TonicKey, this.MusicalModeIndex);
        this.RefreshEditBoxNotes();
    }

    AddTrack(trackNumber)
    {
        ///Create a new track modifier and unlock edits on that track.
        ///TODO: call this when music is imported
        if(trackNumber < v_this.TrackColors.length)
        {
            var track = $('<div>', { class: "trackrow", value:trackNumber, "background-color": v_this.TrackColors[trackNumber], border:'black'});
            var instrumentSelector = $('<select>', { class:"InstrumentSelector", val:"Guitar", text: "📯"});
            //var toggleMute = $('<input>', { text: "⛤"});
            //var toggleLock = $('<input>', { typetext: "⛶"});
            //var toggleMute = '<label class="checkbox-inline"> <input type="checkbox" value="Mute" data-toggle="toggle"> ⛤ </label>'
            //var toggleLock = '<label class="checkbox-inline"> <input type="checkbox" value="Lock" data-toggle="toggle"> ⛶ </label>'
            var toggleMute = '<div class="button" state="0" value="Mute"> ⛤ </label>'
            var toggleLock = '<div class="button" state="0" value="Lock"> ⛶ </label>'

            var pickColor = $('<div>', { text: "֎"}); //click and hold should pull open a color wheel and change all the track colors so they are different
            var toggleButton = '<select data-role="slider"><option value="off">Off</option><option value="on">On</option></select>'

            track.append(instrumentSelector);
            track.append(toggleMute);
            track.append(toggleLock);
            track.append(pickColor);
            track.css('background-color', v_this.TrackColors[trackNumber]);

            $("#trackbox").append(track);
            this.Tracks.push(new Track())
            this.SetTrackInstrument(trackNumber, "");
        }
    }

    DeleteTrack(tracknumber)
    {
        //TODO
        alert("todo");
    }

    RefreshGridPreview()
    {
        this.RefreshEditBoxNotes();
        //TODO set highlight on previews
        this.View.HighlightGridArrayWithIndex(this.Model.GridPreviewIndex);
        this.View.GetGridboxThumbnail(this, this.OnThumbnailRender, this.Model.GridPreviewIndex);
    }

    RefreshEditBoxNotes()
    {
        this.AnalyzeIntervals(this.Model.Score.NoteArray);
        var editModeColor = this.EditModeColors[this.EditorMode];
        this.View.RenderNotes(this.Model.Score.NoteArray, this.NoteColorationMode);
        this.View.RenderPlaybackLine(this.MainPlaybackStartTicks,  this.CapturedPlaybackStartTicks);
    }

    DeleteSelectedNotes(pushAction)
    {
        var i = 0;
        var score = this.Model.Score.NoteArray;
        var sequenceNumber = 0;

        if(pushAction)
        {
            sequenceNumber = this.GetNextSequenceNumber();
        }
        var index = score.length

        //Delete in reverse order to prevent indexing issues after deletion
        while(index-- > 0)
        {
            var note = score[index]
            if(note.IsSelected)
            {
                c_this.Model.DeleteNoteWithIndex(index,sequenceNumber, score, pushAction);
            }
        }
    }

    ModifyNoteArray(noteArray, modifyFunction, forwardIterate=true)
    {
        if(forwardIterate)
        {
            noteArray.some(function(note)
            {
                modifyFunction.call(this,note);
            }, this);
        }
        else
        {
            var modifyIndex = noteArray.length;
            while(modifyIndex-- > 0)
            {
    			var note = noteArray[modifyIndex];
                modifyFunction.call(this,note);
            }
        }
    }

    CountSelectedNotes()
    {
        var selectCount = this.Model.SelectedNotes.length;
        this.console.log("Select count: " + selectCount + " notes.");

        return selectCount;
    }

    GetNextSequenceNumber()
    {
        //Get a sequence number for identifying undo/redo operations. The maximum number should be greater
        //than the size of the undo/redo buffer.
		var maximumSequenceNumber = this.Model.MaximumActivityStackLength + 1;//Number.MAX_SAFE_INTEGER-1;
        this.SequenceNumber = (this.SequenceNumber+1)%maximumSequenceNumber;
        return this.SequenceNumber;
    }

    PreparePasteBuffer(copyBuffer)
    {
        var pasteBuffer = [];

        this.ModifyNoteArray(copyBuffer, function(noteToCopy)
        {
            var noteCopy = new Note(
                noteToCopy.StartTimeTicks,
                noteToCopy.Pitch,
                noteToCopy.Duration,
                noteToCopy.CurrentTrack,
                false);

            var offsetX = this.View.ConvertTicksToXIndex(noteToCopy.StartTimeTicks);
            var offsetY = this.View.ConvertPitchToYIndex(noteToCopy.Pitch);

            var noteCursorDisplacement =
            {
                x: offsetX - this.CursorPosition.x,
                y: offsetY - this.CursorPosition.y,
            }

            var pasteData =
            {
                NoteCopy:noteCopy,
                NoteCursorDisplacement: noteCursorDisplacement,
            }

            pasteBuffer.push(pasteData);
        }, this);

        return pasteBuffer;
    }

    InstantiatePasteBuffer(pasteBuffer)
    {
        //Reset the position of the selected notes in case they were dragged away from their start point
        this.HandleSelectionReset();

        //Instantiate the copied notes
        pasteBuffer.forEach(function(pasteData)
        {
            var noteToPaste = pasteData.NoteCopy;
            var noteCursorDisplacement = pasteData.NoteCursorDisplacement;

            var xticks = noteCursorDisplacement.x + this.CursorPosition.x;
            var yticks = noteCursorDisplacement.y + this.CursorPosition.y;

            var startTimeTicks =
                this.View.ConvertXIndexToTicks(this.CursorPosition.x) +
                this.View.ConvertXIndexToTicks(noteCursorDisplacement.x);

            var pitch =
                this.View.ConvertYIndexToPitch(this.CursorPosition.y) +
                this.View.ConvertYIndexToPitch(noteCursorDisplacement.y);

            var p2 = this.View.ConvertYIndexToPitch(yticks);

            var instantiatedNote = new Note(
                startTimeTicks,
                p2,
                noteToPaste.Duration,
                noteToPaste.CurrentTrack,
                true);

            this.Model.AddNote(instantiatedNote, 0, this.Model.Score.NoteArray, false);
        }, this);
    }

    ResetPlaybackStartTicks(ticks)
    {
        this.MainPlaybackStartTicks = ticks;
    }

    GetNextMidiPitch(midiLowest, midiKeyValues, index)
    {
        var keysLength = midiKeyValues.length
        var octaveOffset = midiLowest + Math.floor(index/keysLength)*12
        var offsetRemainder = midiKeyValues[index % keysLength]

        return octaveOffset + offsetRemainder
    }

    //Midi controller start
    ResetMidiController()
    {
        this.PressedKeys = []
        this.MidiKeysDown = 0

        this.MidiControllerTicks = 0;
        this.MidiTimeoutTicksRemaining = 0;
        this.MidiControllerPendingTimeout = null
    }

    InitializeMidiController()
    {
        this.ResetMidiController()

        this.ChromaticKeyMap = {};
        this.SampleResolutionTicks = 1

        var capsCode = '\f'
        var enterCode = '\r'
        var tabCode = '\t'
        var rShiftCode = '\v'

        var midiLowest = 36 //c2

        //Major scale
        var whiteKeyMidiValues = [0,2,4,5,7,9,11]
        var blackKeyMidiValues = [1,3,6,8,10]

        var chromaticLayout = ["zxcvbnm,./" + "qwertyuiop[]" + "zxcvbnm,./" + "1234567890"]

        var easyLayout =
        [
            //"zxcvbnm,./qwertyuiop[]",
            //"asdfghjkl;'1234567890"
            "sdghjl;1245689-=",
            "zxcvbnm,./qwertyuiop[]",
        ]
        var jankLayout =
        [
            "zxnm," + capsCode + "afghj;'" + enterCode + "qweuio`145670-=",
            "cvb./" + rShiftCode + "sdkl" + tabCode + "rtyP[]2389"
        ]

        var bkeys =  easyLayout[0]
        var wkeys = easyLayout[1]

        //LUT of keys to piano
        var midiPitches = [
            Array.from({length: bkeys.length}, (x,i) => this.GetNextMidiPitch(midiLowest,blackKeyMidiValues,i)),
            Array.from({length: wkeys.length}, (x,i) => this.GetNextMidiPitch(midiLowest,whiteKeyMidiValues,i))
        ]
        //var chromaticMidiPitches = Array.from({length: ckeys.length}, (x,i) => midiLowest+i);

        this.OnMidiControllerKeyDown = this.QuantizerKeyDown;
        this.OnMidiControllerKeyUp = this.QuantizerKeyUp;

        for(var listIndex = 0; listIndex < easyLayout.length; listIndex++)
        {
            var keyLayoutList = easyLayout[listIndex]
            var midiPitchList = midiPitches[listIndex]

            for(var keyIndex = 0; keyIndex < midiPitchList.length; keyIndex++)
            {
                var keyCharacter = keyLayoutList[keyIndex]
                var midiNote = midiPitchList[keyIndex]

                    switch(keyCharacter)
                    {
                        case  capsCode:
                            keyCharacter = 'CapsLock';
                            break;
                        case enterCode:
                            keyCharacter = 'Enter';
                            break;
                        case tabCode:
                            keyCharacter = 'Tab';
                            break;
                        case rShiftCode:
                            keyCharacter = 'Shift';
                            break;
                    }
                this.ChromaticKeyMap[keyCharacter] = midiNote
            }
        }
    }

    CompareNoteWithPitch(pitch, note)
    {
        return pitch - note.Pitch;
    }

    //Add a key at the same instant as other held down keys.
    InstantKeyDown(keyCharacter)
    {
//        this.console.log("InstantKeyDown");//todo removed log
        var pitch = this.ChromaticKeyMap[keyCharacter];
        var selectCount = this.CountSelectedNotes();
        if(selectCount == 0) //on first keydown:
        {
            this.MidiControllerInstantChordNotes = []
            this.MidiControllerTicks = 0;
            this.CapturedPlaybackStartTicks = this.MainPlaybackStartTicks;
        }

        var previewNote = this.CreateMidiControllerNote(pitch);
        previewNote.Duration = this.DefaultNoteDuration;

        this.Model.AddNote(previewNote, 0, this.Model.Score.NoteArray, false);
        this.View.InstantiateNotes([previewNote], this.NoteColorationMode);

        var playbackBuffer = [];
        this.Model.AddNote(previewNote, 0, this.MidiControllerInstantChordNotes, false);

        var playbackMode = this.GetModeSettings().PlaybackMode;
        var includeSuspensions = playbackMode == 2;
        var soloMode = playbackMode == 0;
//        this.console.log("Note netry", this.MidiControllerInstantChordNotes);//todo removed log

        if(!soloMode)
        {
            this.GetPlaybackIntersections(this.MidiControllerInstantChordNotes, playbackBuffer, includeSuspensions);
//            this.console.log("obtained playback intersections: ", playbackBuffer);//todo removed log
        }

        this.ModifyNoteArray(this.MidiControllerInstantChordNotes, function(note)
        {
//            this.console.log("In-chord notes: playing note: ", note);//todo removed log
            this.Model.AddNote(note, 0, playbackBuffer, false);
        }, playbackBuffer);

        if(playbackBuffer.length > 0)
        {
            var includeSelectedNotes = true;
            this.PlayNotes(playbackBuffer,includeSuspensions, includeSelectedNotes);
        }

        return previewNote;

    } //InstantKeyDown

    //Move the playback line forward.
    InstantKeyUp(keyCharacter)
    {
//        this.console.log("InstantKeyUp");//todo removed log
        if(this.MidiKeysDown == 0)
        {
            var selectedNotes = this.Model.SelectedNotes;
            this.MidiControllerInstantChordNotes = [];

            //advance start tick for new notes
            var tickAdvance = 4;
            this.MidiControllerTicks += tickAdvance;
            var newStartTicks = this.CapturedPlaybackStartTicks + this.MidiControllerTicks;

            this.MainPlaybackStartTicks = newStartTicks;//currentNote.StartTimeTicks;
            this.View.RenderPlaybackLine(this.MainPlaybackStartTicks, this.CapturedPlaybackStartTicks);
//            this.console.log("No keys down, advancing ticks to ",newStartTicks)//todo removed log
        }

        return undefined;
    }

    QuantizeNoteLength(note)
    {
        var startTimeTicks = note.StartTimeTicks;
        var durationTicks = note.Duration;

        //Get note duration
        //Find nearest power of two for note duration
        //  triplet case: todo
        //  dotted case: align to strong beat proportional to 3/8 length. nearest 2^n + (2^n-1)
        //  undotted case: align to strong beat proportional to 1/4 length. nearest 2^n
        // set start ticks to nearest strong beat.
        //  boundary strong beats for length: -, 0, +
        //  distance of start ticks to each of the strong beats, pick closest
        var exponent = Math.round(Math.log2(durationTicks));
        var duration = (1<<exponent);
        var modulus = duration;

        var r = startTimeTicks % modulus;
        if(r > modulus/2)
        {
            startTimeTicks += modulus - r;
        }
        else
        {
            startTimeTicks -= r;
        }
        //console.log("Start time quantized x->y/m", note.StartTimeTicks, startTimeTicks, modulus);
        //console.log("Duration quantized x->y", note.Duration, duration);

        note.StartTimeTicks = startTimeTicks;
        note.Duration = duration;

    }
    QuantizerKeyDown(keyCharacter)
    {
        var pitch = this.ChromaticKeyMap[keyCharacter];
        if(this.MidiKeysDown == 0)
        {
            this.HandlePlayback(PlaybackEnumeration.Resume);
            this.KickstartMidiControllerTimeout();
        }

        var previewNote = this.CreateMidiControllerNote(pitch);

        var instrumentCode = this.GetTrackInstrument(previewNote.CurrentTrack);// this.CurrentInstrument;//TrackInstruments[previewNote.CurrentTrack];
        previewNote.PlayIndefinitely(this.MillisecondsPerTick, instrumentCode);

        this.Model.AddNote(previewNote, 0, this.Model.Score.NoteArray, false);
        this.View.InstantiateNotes([previewNote], this.NoteColorationMode);

        return previewNote;
    }

    QuantizerKeyUp(keyCharacter)
    {
//        this.console.log("QuantizerKeyUp");//todo removed log
        var previewNote = this.PressedKeys[keyCharacter];

        this.QuantizeNoteLength(previewNote);
        previewNote.ForceNoteOff();
        this.View.ApplyNoteStyle(previewNote, this.NoteColorationMode);

        return undefined;
    }

    MidiControllerKeyCallback(event)
    {
        var keyCharacter = event.key.toLowerCase();
        var pitch = this.ChromaticKeyMap[keyCharacter];

        var midiKeyPressed = pitch != undefined;
        var keyAlreadyPressed = this.PressedKeys[keyCharacter] != undefined;

        //Create a note
        if(midiKeyPressed)
        {
            event.preventDefault();
            if((event.type == "keydown") && !keyAlreadyPressed)
            {
//                this.console.log(this.OnMidiControllerKeyDown)//todo removed log
                this.PressedKeys[keyCharacter] = this.OnMidiControllerKeyDown(keyCharacter);
                this.MidiKeysDown++;
            }

            else if((event.type == "keyup") && keyAlreadyPressed)
            {
                this.MidiKeysDown--;
                this.PressedKeys[keyCharacter] = this.OnMidiControllerKeyUp(keyCharacter);
            }
        }

        return midiKeyPressed;
    }

    KickstartMidiControllerTimeout()
    {
        //Refresh ticks timeout.
        this.MidiTimeoutTicksRemaining = 16/this.SampleResolutionTicks
        var sampleTimeMilliseconds =  this.SampleResolutionTicks*this.MillisecondsPerTick

        if(this.MidiControllerPendingTimeout == null)
        {
            this.HandleSelectionReset()
            this.MidiControllerPendingTimeout =
                setTimeout($.proxy(this.OnMidiControllerNoteTimeout, this),sampleTimeMilliseconds);
        }
    }

    OnMidiControllerNoteTimeout(note)
	{
        var sampleResolutionTicks = this.SampleResolutionTicks
        var sampleTimeMilliseconds = sampleResolutionTicks*this.MillisecondsPerTick

        if(this.MidiKeysDown > 0)
        {
            for (let note of Object.values(this.PressedKeys))
            {
                if(note != undefined)
                {
                    note.Duration += sampleResolutionTicks
                    this.View.ApplyNoteStyle(note, this.NoteColorationMode)
                }
            }
        }

        //When no keys are pressed, wait 'MidiTimeoutTicksRemaining' ticks before halting recording
        else if(this.MidiTimeoutTicksRemaining > 0)
        {
            this.MidiTimeoutTicksRemaining--;
        }

        else
        {
            this.MidiControllerTicks = 0;
            this.MidiControllerPendingTimeout = null;
            return;
        }

        this.MidiControllerTicks += sampleResolutionTicks
        this.MidiControllerPendingTimeout =
            setTimeout($.proxy(this.OnMidiControllerNoteTimeout, this), sampleTimeMilliseconds);

	}

    CreateMidiControllerNote(pitch)
    {
        //var selectCount = this.CountSelectedNotes();
        //Create a new preview note if edit mode is active
        //if((this.EditorMode == editModeEnumeration.MidiControllerMode) && (selectCount == 0) && (!this.Playing)){

        var startTicks = this.CapturedPlaybackStartTicks + this.MidiControllerTicks//TODO should this.MainPlaybackStartTicks  be added here?
//        this.console.log("capd, miditicks",this.CapturedPlaybackStartTicks, this.MidiControllerTicks);//todo removed log
        var noteIsSelected = true;
        var noteLength = 0//this.SampleResolutionTicks

        var previewNote = new Note(
            startTicks,
            pitch + this.TonicKey,
            noteLength,
            this.CurrentTrack,
            true);

        //}

        return previewNote
    }

    OnKeyPress(event)
    {
        var keyupThisPointer = c_this;
        var eventHandled = false;

        switch(event.keyCode)
        {
        case 13: //enter
        if(event.type == "keyup")
        {
            keyupThisPointer.HandleNoteCommit(true);
        }
        break;
        case 8: //backspace
        if(event.type == "keyup")
        {

        }
        break;
        case 20: //capslock

            if(event.type == "keyup")
            {
                if(
                    (keyupThisPointer.EditorMode != editModeEnumeration.MidiControllerMode) &&
                    (keyupThisPointer.EditorMode != editModeEnumeration.InstantMidiControllerMode))
                {
                    if(event.originalEvent.shiftKey)
                    {
                        keyupThisPointer.OnMidiControllerKeyDown = keyupThisPointer.InstantKeyDown;
                        keyupThisPointer.OnMidiControllerKeyUp = keyupThisPointer.InstantKeyUp;
                        keyupThisPointer.EditorMode = editModeEnumeration.InstantMidiControllerMode;
                    }
                    else
                    {
                        keyupThisPointer.OnMidiControllerKeyDown = keyupThisPointer.QuantizerKeyDown;
                        keyupThisPointer.OnMidiControllerKeyUp = keyupThisPointer.QuantizerKeyUp;
                        keyupThisPointer.EditorMode = editModeEnumeration.MidiControllerMode;
                    }

                    keyupThisPointer.HandleSelectionReset();
                }

                else
                {
                    keyupThisPointer.EditorMode = editModeEnumeration.SELECT;
                }

                var editModeColor = keyupThisPointer.EditModeColors[keyupThisPointer.EditorMode];
                keyupThisPointer.View.SetBorderColor(editModeColor);
            }
            break;

        case 27: //escape
            keyupThisPointer.ResetMidiController();
            keyupThisPointer.HandleSelectionReset();
            break;
        }

        if(keyupThisPointer.EditorMode == editModeEnumeration.MidiControllerMode)
        {
            eventHandled = keyupThisPointer.MidiControllerKeyCallback(event)
        }
        if(keyupThisPointer.EditorMode == editModeEnumeration.InstantMidiControllerMode)
        {
            eventHandled = keyupThisPointer.MidiControllerKeyCallback(event)
        }

        if(!eventHandled)
        {
            eventHandled = keyupThisPointer.HandleCompositionModeKeypress(event)
        }
    }

    //Midi controller end

	SetGridWidth(gridWidth)
	{
		this.Model.Score.GridWidth = gridWidth;
		this.RefreshGridboxBackground()
	}

	RefreshGridboxBackground()
	{
		this.View.GridWidthTicks = this.Model.Score.GridWidth;
		this.SetKeyReference(this.TonicKey, this.MusicalModeIndex);
	}

    //Composition mode controller begin
    HandleCompositionModeKeypress(event)
    {
        //Mode control: select, edit, delete
        if(event.type == "keyup")
        {
            return false;
        }

        switch(event.keyCode)
        {
        case 88: //"x" key": Select mode
            if(this.EditorMode != editModeEnumeration.SELECT)
            {
                this.EditorMode = editModeEnumeration.SELECT;
                var editModeColor = this.EditModeColors[this.EditorMode];
                this.HandleSelectionReset();
                this.View.SetBorderColor(editModeColor);
            }

            break;
        case 90: //"z" key" undo/redo, Edit mode
            var renderGrid = true;
            //Undo
            if(event.ctrlKey)
            {
                //If a group is being selected, unselect it
                var selectCount = this.CountSelectedNotes();
                if(selectCount > 1)
                {
                    this.HandleSelectionReset()
                }
                else
                {
                    this.Model.Undo();
                    this.StopPlayingNotes();
                }
            }

            //Redo
            else if(event.shiftKey)
            {
                this.Model.Redo();
                this.StopPlayingNotes();
            }

            //Enter edit mode
            else if(this.EditorMode != editModeEnumeration.EDIT)
            {
                this.EditorMode = editModeEnumeration.EDIT;
                var editModeColor = this.EditModeColors[this.EditorMode];
                this.HandleSelectionReset();
                this.CreateUniqueEditNote();
                this.View.SetBorderColor(editModeColor);
            }
            else {
                renderGrid = false;
            }
            if(renderGrid)
            {
                this.RefreshEditBoxNotes();
            }

            break;

		case 219: //"[" key
			//Make sure not to underflow past note ticks
			var gridWidth = this.View.GridWidthTicks - 16;
			var lastTick = 512;
			var score = this.Model.Score.NoteArray;
			var currentGridWidth = this.View.GridWidthTicks
			if(score.length > 0)
			{
				var lastNote = score[score.length-1];
				lastTick = lastNote.StartTimeTicks + lastNote.Duration;
			}

			var shrinkingGrid = (gridWidth < currentGridWidth);
			var gridBoundaryClippingLastNote = (gridWidth > lastTick);

			if((shrinkingGrid && gridBoundaryClippingLastNote) || (!shrinkingGrid))
			{
				this.SetGridWidth(gridWidth);
			}
			break;

		case 221: //"]" key
			var gridWidth = this.View.GridWidthTicks + 16;
			this.SetGridWidth(gridWidth);
			break;

        case 46: //"del" key
        case 68: //"d" key
            //Delete any selected notes
            this.DeleteSelectedNotes(true);
            this.RefreshGridPreview()
            break;
        case 9: //tab key
            event.preventDefault();
            var keys = 12;
            if(event.shiftKey)
            {
                this.TonicKey = (this.TonicKey+(keys-7))%keys;
            }
            else
            {
                this.TonicKey = (this.TonicKey+7)%keys;
            }
            this.SetKeyReference(this.TonicKey, this.MusicalModeIndex);

            break;

		case 75: //"k" key : change coloration mode
			this.NoteColorationMode = !this.NoteColorationMode;
			this.View.UpdateExistingNotes(this.Model.Score.NoteArray, this.NoteColorationMode);
			break;

        case 192: //` tilde key: change mode
            this.MusicalModeIndex = (this.MusicalModeIndex+1) % Modes.length;
            this.SetKeyReference(this.TonicKey, this.MusicalModeIndex);
            break;

        case 32: //spacebar
            event.preventDefault();
            if(!this.Playing)
            {
                if(event.shiftKey)
                {
                    this.HandlePlayback(PlaybackEnumeration.RestartFromLastStart);
                }

                //Ctrl space:
                else if(event.ctrlKey)
                {
                    this.HandlePlayback(PlaybackEnumeration.RestartFromBeginning);
                }

                //Regular space:
                else
                {
                    this.HandlePlayback(PlaybackEnumeration.Resume);
                }

            }
            else
            {
                this.StopPlayingNotes();
            }


            break;

        case 67: //"c" key"
            var copyBuffer = [];

            //Copy all selected notes into a buffer
            this.ModifyNoteArray(this.Model.SelectedNotes, function(noteToCopy)
            {
                copyBuffer.push(noteToCopy);
            });

            this.PasteBuffer = this.PreparePasteBuffer(copyBuffer);
            this.InstantiatePasteBuffer(this.PasteBuffer);

            this.RefreshEditBoxNotes();
            break;

        case 86: //"v" key
            this.InstantiatePasteBuffer(this.PasteBuffer);
            this.RefreshGridPreview();

            break;

        case 65: //"a key"
            //ctrl+a: select all
            if(event.ctrlKey)
            {
                event.preventDefault();
                this.SelectAllNotes();
            }

        case 81: //"q" key
            break;

        //Numeric keys
        case 48: //key 0
            event.keyCode += 10; //no track 0, just track 10
        case 49: //key 1
        case 50: //...
        case 51:
        case 52:
        case 53:
        case 54:
        case 55: //...
        case 56: //key 8
        case 57: //key 9

            var pressedKey = event.keyCode - 49;
            this.CurrentTrack = pressedKey;

            break;

        case 69: //"e" key: invert bass down octave
            this.InvertVoices(true);
            break;

        case 87: //"w" key: Invert bass up octave
            this.InvertVoices(false);

            break;

        case 82: //"r" key:  Add new grid
            this.Model.CreateGridPreview();
            this.RefreshGridPreview();
            break;
        case 38: //up arrow: go to previous grid
			//TODO: if notes are selected move them up and down and side to side
            event.preventDefault();
            this.HandleGridMove(this.Model.GridPreviewIndex-1);
            this.RefreshGridPreview();
            break;
        case 40: //down arrow: go to next grid
            event.preventDefault();
            this.HandleGridMove(this.Model.GridPreviewIndex+1);
            this.RefreshGridPreview();
            break;
        }
    }

    //Composition mode controller end
    HandlePlayback(playbackMode)
    {
        if(!this.Playing)
        {
            var playbackBuffer = []
            this.HandleSelectionReset();

            //Find note closest to playback coordinate
            //Shift space: reset the play index to the last captured point
            PlaybackEnumeration

            switch(playbackMode)
            {
                case PlaybackEnumeration.Resume:
                    //overwrite the last captured point and play from wherever the playback cursor is
                    this.CapturedPlaybackStartTicks = this.MainPlaybackStartTicks;
                    break;

                case PlaybackEnumeration.RestartFromBeginning:
                    //reset play index to beginning of grid
                    this.ResetPlaybackStartTicks(0);
                    this.CapturedPlaybackStartTicks = this.MainPlaybackStartTicks;
                    break;
                case PlaybackEnumeration.RestartFromLastStart:
                    //
                    this.ResetPlaybackStartTicks(this.CapturedPlaybackStartTicks);
                    break;
            }

            var score = this.Model.Score.NoteArray;
            var playbackStartXCoordinate = this.View.ConvertTicksToXIndex(this.MainPlaybackStartTicks);

            var selectionRectangle =
            {
                x1: playbackStartXCoordinate,
                y1: 0,
                x2: playbackStartXCoordinate,
                y2: 'Infinity',
            };

            //
            var searchResult = this.GetNoteIndexOfOverlappingNote(selectionRectangle);
            var [searchIndex, binarySearchResult] = [searchResult.ClickedNoteIndex, searchResult.BinarySearchIndex]

            //Handle case where playback cursor is before any notes
            if((searchIndex < 0) && (binarySearchResult < score.length))
            {
                searchIndex = binarySearchResult-1;
            }
            if(searchIndex >= 0)
            {
                //Add all unselected notes after the playback index to the playback buffer
                var [playbackBuffer,x] = this.GetChordNotes(score, searchIndex, false);
                for(searchIndex; searchIndex<score.length;searchIndex++)
                {
                    var note = score[searchIndex];
                    if(!note.IsSelected)
                    {
                        playbackBuffer.push(note);
                    }
                }

                this.PlayNotes(playbackBuffer, false);
            }
        }
    }

    //Make all notes "selected", meaning:
    //  - they respond to mouse dragging
    //  - they are highlighted or focused on
    //  -
    SelectAllNotes()
    {
        this.ModifyNoteArray(this.Model.Score.NoteArray, function(note)
        {
            note.IsSelected = true;
            this.View.ApplyNoteStyle(note, this.NoteColorationMode);
        });
    }

    set CurrentTrack(trackNumber)
    {
        if(trackNumber < 0)
        {
            trackNumber = 0;
        }
        this._CurrentTrack = trackNumber;

        this.ModifyNoteArray(this.Model.SelectedNotes, function(note)
        {
            note.CurrentTrack = this._CurrentTrack;
            this.View.ApplyNoteStyle(note, this.NoteColorationMode);
        });

        this.View.SelectTrack(trackNumber);
    }

    get CurrentTrack()
    {
        if(this._CurrentTrack < 0)
        {
            this._CurrentTrack = 0;
        }
        return this._CurrentTrack;
    }

    HandleGridMove(gridIndex)
    {
        var moveFunction;
        var copyBuffer = [];
		var oldGridIndex = this.Model.GridPreviewIndex
        var newGridIndex;
		var newGridWidth = 0;

		var originalGridWidth = this.View.GridWidthTicks;

        this.Model.SetCurrentGridPreview(this.Model.Score);
        this.console.log("Transport begin");

        //Capture any selected notes and delete them before changing grids
        this.ModifyNoteArray(this.Model.SelectedNotes, function(note)
        {
			var copiedNote = note;
            this.console.log("Packing note: ", note);
            copyBuffer.push(copiedNote);
        });

        this.DeleteSelectedNotes(false, 0);

        //Change to the next grid
        //moveFunction.call(this.Model);
		this.Model.GotoGridView(gridIndex);
		newGridIndex = this.Model.GridPreviewIndex;

        //Instantiate the copied notes in the next buffer
        copyBuffer.forEach(function(note)
        {
//            this.console.log("Transporting note: ", note, oldGridIndex, newGridIndex);//todo removed log
			note.CurrentGridIndex = newGridIndex;
            this.Model.AddNote(note, 0, this.Model.Score.NoteArray, false);
            this.Model.AddNote(note, 0, this.Model.SelectedNotes, false);
        },this);

		var currentGridWidth = this.View.GridWidthTicks;
		var targetGridWidth = this.Model.Score.GridWidth;

		this.SetGridWidth(targetGridWidth);
//		this.console.log("Transport end:", originalGridWidth, currentGridWidth, targetGridWidth);//todo removed log
    }

    InvertVoices(moveHighestVoiceByOctave)
    {
        var analysisMode = this.GetModeSettings().AnalysisMode;
        const analysisOffsets = [
            -12, //free: everything goes down an octave
            12, //15th: a perfect octave
            7,  //12th: a fifth
            4, //10th: a 3rd (3 or 4?)
        ];

        const analysisOffset = analysisOffsets[analysisMode];

        var lowestPitch = Number.POSITIVE_INFINITY;
        var highestPitch = Number.NEGATIVE_INFINITY;
        var candidatePitch;

        var noteWithHighestPitch = undefined;
        var noteWithLowestPitch = undefined;

        var bassOffset = 12;
        var upperVoiceOffset = analysisOffset;

        if(moveHighestVoiceByOctave)
        {
            bassOffset = analysisOffset;
            upperVoiceOffset = 12;
        }

        this.ModifyNoteArray(this.Model.SelectedNotes, function(candidateNote)
        {
            candidatePitch = candidateNote.Pitch;
            if (candidatePitch < lowestPitch)
            {
                lowestPitch = candidatePitch;
                noteWithLowestPitch = candidateNote;
            }
            if (candidatePitch > highestPitch)
            {
                highestPitch = candidatePitch;
                noteWithHighestPitch = candidateNote;
            }
        });

        var highestNewPosition = (lowestPitch + bassOffset);
        var lowestNewPosition = (highestPitch - upperVoiceOffset);
        var upperBoundCheck =
            (0 < highestNewPosition) &&
            (highestNewPosition <= this.View.MaximumPitch);

        var lowerBoundCheck =
            (0 < lowestNewPosition) &&
            (lowestNewPosition <= this.View.MaximumPitch);

        if(lowerBoundCheck && upperBoundCheck)
        {
            const topTrack = noteWithHighestPitch.CurrentTrack;
            const bassTrack = noteWithLowestPitch.CurrentTrack;

            this.ModifyNoteArray(this.Model.SelectedNotes, function(note)
            {
                if(note.CurrentTrack == bassTrack)
                {
                    note.Pitch += bassOffset;
                    note.CurrentTrack = topTrack;
                    this.View.ApplyNoteStyle(note, this.NoteColorationMode);
                }

                else if(note.CurrentTrack == topTrack)
                {
                    note.Pitch -= upperVoiceOffset;
                    note.CurrentTrack = bassTrack;
                    this.View.ApplyNoteStyle(note, this.NoteColorationMode);
                }
            });
        }
    }

    GetNextUnselectedNote()
    {
        var note = null;

        //Get the next note that isn't selected
        while(this.NoteIndex < this.Model.Score.NoteArray.length)
        {
            var note = this.Model.Score.NoteArray[this.NoteIndex ];

            this.NoteIndex++;
            if(!note.IsSelected)
            {
                break;
            }
            else
            {
                note = null;
            }
        }

        return note;
    }

    DoNotesOverlap(note1, note2)
    {
        var note1SearchStartTicks = note1.StartTimeTicks;
        var note1SearchEndTicks = note1SearchStartTicks + note1.Duration;

        var note2SearchStartTicks = note2.StartTimeTicks;
        var note2SearchEndTicks = note2SearchStartTicks + note2.Duration;

        var note2StartsDuringNote1 =
            (note1SearchStartTicks <= note2SearchStartTicks) && (note2SearchStartTicks < note1SearchEndTicks);

        var note1StartsDuringNote2 =
            (note2SearchStartTicks <= note1SearchStartTicks) && (note1SearchStartTicks < note2SearchEndTicks);

        var results = {
            Note1Subordinate:note1StartsDuringNote2,
            Note2Subordinate:note2StartsDuringNote1,
        };

        return results;
    }

    ShouldIncludeNote(targetNote,searchNote,includeSuspensions)
    {
        var result = false;

        var overlapResult = this.DoNotesOverlap(targetNote, searchNote)
        var suspensionOrChordNote = overlapResult.Note1Subordinate;
        var chordNote = overlapResult.Note1Subordinate && overlapResult.Note2Subordinate;

        result = (includeSuspensions && suspensionOrChordNote) || (!includeSuspensions && chordNote);

        return result;
    }

    //Search a given note array for chord notes. If suspensions are included, then notes that begin
    //before the note with the given note index will be included if they overlap with the note at the
    //note index. Return the chord notes and the index of the first note in the next chord
    GetChordNotes(noteArray, noteIndex, includeSuspensions, includeSelectedNotes=false)
    {
        var leftSearchIndex = noteIndex - 1;
        var rightSearchIndex = noteIndex + 1;
        var currentNote = noteArray[noteIndex];
        var chordNotes = [currentNote];
        var returnIndex = noteArray.length;
        var currentNoteStartTicks = currentNote.StartTimeTicks;
        var wholeNoteDurationTicks = 16;

        //search left
        while(leftSearchIndex >= 0)
        {
            var leftSearchNote = noteArray[leftSearchIndex];
            if(!leftSearchNote.IsSelected || includeSelectedNotes)
            {
                var searchNoteTickDifference = currentNoteStartTicks - leftSearchNote.StartTimeTicks;

                //includeSuspensions: Search left until the start ticks are out of range (a whole note)
                //otherwise: Search until the start ticks are no longer equivalent
                if((includeSuspensions && (searchNoteTickDifference >= wholeNoteDurationTicks)) ||
                    (!includeSuspensions && (searchNoteTickDifference != 0)))
                {
                    break;
                }
                else
                {
                    var noteInChord = this.ShouldIncludeNote(currentNote,leftSearchNote, includeSuspensions);
                    if(noteInChord)
                    {
                        chordNotes.unshift(leftSearchNote);
                    }
                }
            }

            leftSearchIndex--;
        }

        //search right
        while(rightSearchIndex < noteArray.length)
        {
            var rightSearchNote = noteArray[rightSearchIndex];
            var validSearchNote =  !rightSearchNote.IsSelected || includeSelectedNotes;
            if(validSearchNote)
            {
                var noteInChord = this.ShouldIncludeNote(currentNote,rightSearchNote, includeSuspensions);
                if(noteInChord)
                {
                    chordNotes.push(rightSearchNote);
                }

                //The first invalid unselected note on the right side will be the longest note of the next chord
                //as a result of the note sorting order
                else if(validSearchNote)
                {
                    returnIndex = rightSearchIndex;
                    break;
                }
            }
            rightSearchIndex++;
        }

        //Return the chord notes and the index of the first note in the next chord
        return [chordNotes,returnIndex];
    }

	OnStopNote(note)
	{
        note.IsHighlighted = false;
        this.View.ApplyNoteStyle(note, this.NoteColorationMode)
	}

    PlayChord(noteArray, noteIndex, includeSuspensions, includeSelectedNotes=false)
    {
        //Get all notes that play during this note, return the index of the first note that won't be played in this chord
        var [chordNotes,returnIndex] = this.GetChordNotes(noteArray, noteIndex, includeSuspensions, includeSelectedNotes)
//        this.console.log(chordNotes)//todo removed log

        this.ModifyNoteArray(chordNotes, function(note)
        {
            var instrumentCode = this.GetTrackInstrument(note.CurrentTrack);
//            this.console.log("start play",this.MillisecondsPerTick, this, this.OnStopNote, instrumentCode);//todo removed log
            note.Play(this.MillisecondsPerTick, this, this.OnStopNote, instrumentCode);
            this.View.ApplyNoteStyle(note, this.NoteColorationMode);
        });

        return returnIndex;
    }

    OnPlayAllNotes(includeSuspensions=false, includeSelectedNotes=false)
    {
        var playbackNoteArray = this.PlaybackNoteArray;
        const noteIndex = this.NoteIndex;
        const currentNote = playbackNoteArray[noteIndex];
        const nextNoteIndex = this.PlayChord(playbackNoteArray, noteIndex, includeSuspensions, includeSelectedNotes);

        if(nextNoteIndex < playbackNoteArray.length)
        {
            const nextNote = playbackNoteArray[nextNoteIndex];
            const relativeDelta = nextNote.StartTimeTicks - currentNote.StartTimeTicks;
            var delta = relativeDelta*this.MillisecondsPerTick;

            this.NoteIndex = nextNoteIndex;

            //Adjust for drift
            if(this.ExpectedTime == undefined)
            {
                this.ExpectedTime = Date.now() + delta;
            }
            //Find the difference between the actual time and the expected time
            //negative skew time: event happened early
            //positive skew time: event happened late
            else
            {
                var skewTime = Date.now() - this.ExpectedTime;
                this.ExpectedTime += delta;
                delta = Math.max(0, delta - skewTime);
            }

            this.PendingTimeout = setTimeout(
                $.proxy(this.OnPlayAllNotes, this),delta);

            var xStart = this.View.ConvertTicksToXIndex(currentNote.StartTimeTicks);
            var yStart = this.View.ConvertPitchToYIndex(currentNote.Pitch);
            var xDestination = this.View.ConvertTicksToXIndex(nextNote.StartTimeTicks);
            var yDestination =  this.View.ConvertPitchToYIndex(nextNote.Pitch);

            this.View.AutoScroll(xStart, yStart, xDestination, yDestination, this.MillisecondsPerTick)

            //Update playback line after playing each chord
            this.MainPlaybackStartTicks = currentNote.StartTimeTicks;
            this.View.RenderPlaybackLine(this.MainPlaybackStartTicks, this.CapturedPlaybackStartTicks);
        }

        else
        {
            this.MainPlaybackStartTicks = currentNote.StartTimeTicks;
            this.StopPlayingNotes();
        }

    }

    PlayNotes(noteArray, includeSuspensions,includeSelectedNotes=false)
    {
        this.NoteIndex = 0;
        this.ResetPlayback();

        if(noteArray.length > 0)
        {
            this.PlaybackNoteArray = noteArray

            this.Playing = true;
            var firstNote = noteArray[0];
            var lastNote = noteArray[noteArray.length-1];
            var startTime = firstNote.StartTimeTicks;
            var endTime = lastNote.StartTimeTicks + lastNote.Duration;
            var startX = this.View.ConvertTicksToXIndex(startTime);
            var endX = this.View.ConvertTicksToXIndex(endTime);
            var playbackDurationMilliseconds = (endTime - startTime)*this.MillisecondsPerTick;

            //Begin scrolling along with the notes
			if(firstNote.StartTimeTicks != lastNote.StartTimeTicks)
			{
                //Find the middle Y coordinate
				var [chord,x] = this.GetChordNotes(noteArray, 0, includeSuspensions);
				var averagePitchSum = 0;
				chord.forEach(function(note)
				{
					averagePitchSum += note.Pitch;
				});

				var averagePitch = averagePitchSum / chord.length;
				var ycoord = this.View.ConvertPitchToYIndex(averagePitch);

				this.View.SmoothScroll(startX, ycoord, 500);
			}
//            this.console.log("Play notes", noteArray);//todo removed log
            this.OnPlayAllNotes(includeSuspensions, includeSelectedNotes);
        }
    }

    ResetPlayback()
    {
        this.ExpectedTime = undefined;
        this.View.ResetAutoScroll();
        clearTimeout(this.PendingTimeout);
        this.View.RenderPlaybackLine(this.MainPlaybackStartTicks,  this.CapturedPlaybackStartTicks);
    }

    StopPlayingNotes()
    {
        this.Playing = false;
        this.ResetPlayback();

        this.CreateUniqueEditNote();
    }

    CreateUniqueEditNote()
    {
        var selectCount = this.CountSelectedNotes();

        //Create a new preview note if edit mode is active
        if((this.EditorMode == editModeEnumeration.EDIT) && (selectCount == 0) && (!this.Playing))
        {
            var noteDuration = Math.max(1, this.DefaultNoteDuration);
            var startTicks = this.View.ConvertXIndexToTicks(this.CursorPosition.x);
            var pitch = this.View.ConvertYIndexToPitch(this.CursorPosition.y);
            var noteIsSelected = true;
            var previewNote = new Note(
                startTicks,
                pitch,
                noteDuration,
                this.CurrentTrack,
                true);

            this.Model.AddNote(previewNote, 0, this.Model.Score.NoteArray, false);
            c_this.View.InstantiateNotes([previewNote], this.NoteColorationMode);
        }
    }

    OnHoverBegin(event)
    {
        if(!c_this.Hovering)
        {
            c_this.Hovering = true;

            c_this.CreateUniqueEditNote();
        }
    }

    OnHoverEnd(event)
    {
        if(c_this.Hovering)
        {
            c_this.Hovering = false;
            if(c_this.Model.SelectedNotes.length > 0)
            {
                c_this.HandleSelectionReset();
                c_this.RefreshEditBoxNotes();
            }
        }
    }

    OnSliderChange(tempo)
    {
        //60,000ms = 1 minute
        //1 Tempo = 1 beat / minute = (8 ticks)/60,000ms = K ticks/ms
        //milliseconds per tick = K/Tempo
        c_this.MillisecondsPerTick = 7500/tempo;

    }

    HandleSelectionReset()
    {
        this.console.log("Resetting all selected notes:")
        this.ModifyNoteArray(this.Model.SelectedNotes, function(note)
        {
            //Unselect and reset the position of notes that existed before selection
			if(note.StateWhenSelected != null)
			{
                this.console.log("Handling reset with reposition",note)
				note.IsSelected = false;
				note.ResetPosition();
			}

			//Delete preview notes that were not initially selected
			else
			{
                this.console.log("Handling reset with deletion",note)
				this.Model.DeleteNote(note, 0, this.Model.Score.NoteArray, false);
                this.View.DeleteNotes([note]);
			}
        }, false);

        this.AnalyzeIntervals(this.Model.Score.NoteArray);
        this.View.UpdateExistingNotes(this.Model.Score.NoteArray, this.NoteColorationMode);
    }

    ///Update the cursor position, move all selected notes
    OnMouseMove(cursorPosition)
    {
        var mouseMoveThisPointer = c_this;

		//Only process mouse move events if the position changes
        if((mouseMoveThisPointer.CursorPosition.x != cursorPosition.x) ||
            (mouseMoveThisPointer.CursorPosition.y != cursorPosition.y))
        {
            mouseMoveThisPointer.LastCursorPosition = mouseMoveThisPointer.CursorPosition;
			mouseMoveThisPointer.CursorPosition = cursorPosition;

			//If there are selected notes, move them
			var selectCount = mouseMoveThisPointer.CountSelectedNotes();

			//If a selection rectangle is being drawn, begin selecting notes caught in the rectangle
			if(mouseMoveThisPointer.SelectingGroup)
			{
				mouseMoveThisPointer.View.RenderSelectRectangle(mouseMoveThisPointer.SelectorPosition, mouseMoveThisPointer.CursorPosition);
				var selectRectangle =
				{
					x1: Math.min(mouseMoveThisPointer.SelectorPosition.x, mouseMoveThisPointer.CursorPosition.x),
					y1: Math.min(mouseMoveThisPointer.SelectorPosition.y, mouseMoveThisPointer.CursorPosition.y),
					x2: Math.max(mouseMoveThisPointer.SelectorPosition.x, mouseMoveThisPointer.CursorPosition.x),
					y2: Math.max(mouseMoveThisPointer.SelectorPosition.y, mouseMoveThisPointer.CursorPosition.y)
				};

				mouseMoveThisPointer.ModifyNoteArray(mouseMoveThisPointer.Model.Score.NoteArray, function(note)
				{
					var noteRectangle = mouseMoveThisPointer.GetNoteRectangle(note);
					var noteIsCaptured = mouseMoveThisPointer.DoesRectangle1CoverRectangle2(selectRectangle, noteRectangle);
                    var noteSelectionInitialState = note.IsSelected;

					if(noteIsCaptured)
					{
						note.IsSelected = true;
					}

					else
					{
						note.IsSelected = false;
					}

                    if(noteSelectionInitialState != note.IsSelected)
                    {
                        this.View.ApplyNoteStyle(note, this.NoteColorationMode);
                    }
				});
			}

			//If no selection rectangle is being drawn, move all selected notes
			else if(selectCount > 0)
			{
                var selectedNotes = mouseMoveThisPointer.Model.SelectedNotes;

				var x_offset =
					mouseMoveThisPointer.View.ConvertXIndexToTicks(mouseMoveThisPointer.CursorPosition.x) -
					mouseMoveThisPointer.View.ConvertXIndexToTicks(mouseMoveThisPointer.LastCursorPosition.x);

				var y_offset =
					mouseMoveThisPointer.View.ConvertYIndexToPitch(mouseMoveThisPointer.CursorPosition.y) -
					mouseMoveThisPointer.View.ConvertYIndexToPitch(mouseMoveThisPointer.LastCursorPosition.y);

				var previousNote = undefined;
				function IsScaleDegree(pitch)
				{
					return false;
				}

				mouseMoveThisPointer.ModifyNoteArray(selectedNotes, function(note)
				{
					//Tonal transpose?

					note.Move(x_offset, y_offset);
					previousNote = note;

				});


                mouseMoveThisPointer.Model.MergeSort(selectedNotes);
                mouseMoveThisPointer.Model.MergeSort(mouseMoveThisPointer.Model.Score.NoteArray);
                mouseMoveThisPointer.AnalyzeIntervals(mouseMoveThisPointer.Model.Score.NoteArray);

			}
            //mouseMoveThisPointer.SetKeyReference(mouseMoveThisPointer.TonicKey, mouseMoveThisPointer.MusicalModeIndex);
            //TODO: draw a circle around cursor showing note colors
		}
    } //end OnMouseMove

    HandleIndividualNotePlayback(noteIndex, playbackMode)
    {
        var score = this.Model.Score.NoteArray;
        var note = score[noteIndex];

		//Solo
        if(playbackMode == 0)
        {
            this.PlayChord([note], noteIndex, false)
        }

		//Chords: play notes that have the same start time
        else if(playbackMode == 1)
        {
            this.PlayChord(score, noteIndex, false)
        }

		//Suspensions: play notes whose durations extend over the selected note
        else
        {
            this.PlayChord(score, noteIndex, true)
        }
    }

	GetModeSettings(eventData=undefined)
	{
        if(eventData == undefined)
        {
             eventData = this.View.GetFormData();
        }

		var modeSettings = {};

		eventData.forEach(function(formData)
		{
			if(formData.id == 'PlayPreview')
			{
				modeSettings.PlaybackMode = formData.value;
			}

            if(formData.id == 'Analysis')
            {
                modeSettings.AnalysisMode = formData.value;
            }
		});

		return modeSettings;
	}

    OnMouseClickDown(event)
    {
        var clickdownThisPointer = c_this;

        if(event.which !== 1)
        {
            return;
        }

		//event.preventDefault();
        //if editor mode in list
        if([editModeEnumeration.SELECT, editModeEnumeration.MidiControllerMode, editModeEnumeration.InstantMidiControllerMode].indexOf(clickdownThisPointer.EditorMode) >-1)
        //if((clickdownThisPointer.EditorMode == editModeEnumeration.SELECT) || (clickdownThisPointer.EditorMode == editModeEnumeration.MidiControllerMode))
        {
            var selectCount = clickdownThisPointer.CountSelectedNotes();
            var clickedNoteIndex = clickdownThisPointer.GetNoteIndexOfOverlappingNote().ClickedNoteIndex;
            var score = clickdownThisPointer.Model.Score.NoteArray;

            //If a note is clicked, select it
            if((0 <= clickedNoteIndex) && (clickedNoteIndex < score.length))
            {
                score[clickedNoteIndex].IsSelected = true;
            }

            //If there are no selected notes, create a select rectangle
            else if(selectCount == 0)
            {
                clickdownThisPointer.SelectingGroup = true;
                clickdownThisPointer.SelectorPosition = clickdownThisPointer.CursorPosition;
                clickdownThisPointer.View.RenderSelectRectangle(clickdownThisPointer.SelectorPosition, clickdownThisPointer.CursorPosition);
            }
        }
    } //end OnMouseClickDown

    ///Unselect all selected notes to anchor them and play them
    OnMouseClickUp(event)
    {
        if(event.which !== 1)
        {
            return;
        }

        var executingMove = true;
		c_this.HandleNoteCommit(executingMove);

    } //end OnMouseClickUp

    HandleRectangleEndGrab()
    {
        var selectCount = this.CountSelectedNotes();
        this.View.DeleteSelectRectangle();
        this.SelectingGroup = false;
        if(selectCount === 0)
        {
            var clickupTicks = this.View.ConvertXIndexToTicks(this.CursorPosition.x);
            this.ResetPlaybackStartTicks(clickupTicks);
        }
    }

    GetPlaybackIntersections(targetBuffer, playbackBuffer, includeSuspensions)
    {
        const selectedBufferEndIndex = targetBuffer.length-1;
        const firstSelectedNote = targetBuffer[0];
        const startTickBoundary = firstSelectedNote.StartTimeTicks;
        const endTickBoundary =
            targetBuffer[selectedBufferEndIndex].StartTimeTicks +
            targetBuffer[selectedBufferEndIndex].Duration;

        this.ModifyNoteArray(this.Model.Score.NoteArray, function(note)
        {
            if(!note.IsSelected)
            {
                var intersectsSelectedNote =
                    (startTickBoundary <= note.StartTimeTicks) &&
                    (note.StartTimeTicks < endTickBoundary);

                var suspendsOverFirstNote =
                    this.ShouldIncludeNote(firstSelectedNote,note,includeSuspensions);

                if(intersectsSelectedNote)
                {
                    this.Model.AddNote(note, 0, playbackBuffer, false);
                }

                else if(suspendsOverFirstNote)
                {
                    var suspendDummyNote = new Note(
                        firstSelectedNote.StartTimeTicks,
                        note.Pitch,
                        firstSelectedNote.Duration,
                        firstSelectedNote.CurrentTrack,
                        false);
                    this.Model.AddNote(suspendDummyNote, 0, playbackBuffer, false);
                }
             }
        });
    }

    HandleCommitPlayback(executingMove)//for end of note drag
    {
        var selectCount = this.CountSelectedNotes();
        var selectedNotes = this.Model.SelectedNotes;
        var mainScore = this.Model.Score.NoteArray;

        var playbackBuffer = [];
        var playbackMode = this.GetModeSettings().PlaybackMode;
        var sequenceNumber = sequenceNumber = this.GetNextSequenceNumber();

        var includeSuspensions = playbackMode == 2;
        var soloMode = playbackMode == 0;

        //Play all intersecting chords and handle move completion. If playback mode == 0 (solo),
        //do not search for intersecting chords.
        if((selectCount > 0) && !soloMode)
        {
            //Find all notes in the score that intersect with the selected notes
            var selectedNotes = this.Model.SelectedNotes;
            this.GetPlaybackIntersections(selectedNotes, playbackBuffer, includeSuspensions);
        }

        //Push all selected notes to the playback buffer, unselect them to place them and handle
        //move completion. Reverse iterate to allow deselection, which removes notes from the
        //selectedNotes buffer
        this.ModifyNoteArray(selectedNotes, function(note)
        {
            this.Model.AddNote(note, 0, playbackBuffer, false);
            note.IsSelected = false;
            note.OnMoveComplete(sequenceNumber);
            this.View.ApplyNoteStyle(note, this.NoteColorationMode);
            this.console.log("OnUnselect: playing note: ", note);
        }, false);

        //Move the playback line
        if(playbackBuffer.length > 0)
        {
            this.ResetPlaybackStartTicks(playbackBuffer[0].StartTimeTicks);
            this.PlayNotes(playbackBuffer,includeSuspensions);
        }
    }

    HandleNoteCommit(executingMove)
    {
        //event.preventDefault();
        this.StopPlayingNotes();
        var wasSelectingGroup = this.SelectingGroup === true;

        //Make sure both buffers are sorted to begin with
        this.Model.MergeSort(this.Model.Score.NoteArray);
        this.Model.MergeSort(this.Model.SelectedNotes);

        //If a group was selected, close a rectangle
        if(wasSelectingGroup)
        {
            this.HandleRectangleEndGrab()
        }

        else
        {
            this.HandleCommitPlayback(executingMove);
        }

        this.CreateUniqueEditNote();
        this.View.RenderPlaybackLine(this.MainPlaybackStartTicks,  this.CapturedPlaybackStartTicks);
    }

    //Resize notes
    HandleControlScroll(scrollUp)
    {
        var shouldScroll = true;
        var selectCount = this.CountSelectedNotes();
        var noteArray = this.Model.Score.NoteArray;

        if(selectCount != 0)
        {
            noteArray = this.Model.SelectedNotes;
        }

        //If no notes are selected, handle control+scroll as a zoom
        else
        {
            //Capture the position of the cursor in terms of ticks with the current pixels per tick
            var cursorTickPosition =
            {
                x: this.View.ConvertXIndexToTicks(this.CursorPosition.x),
                y: this.View.ConvertYIndexToPitch(this.CursorPosition.y),
            };

            //Change the pixels per tick
            if(scrollUp && (this.View.PixelsPerTick < 40))
            {
                this.View.PixelsPerTick = this.View.PixelsPerTick*2;
            }

            else if(!scrollUp && (this.View.PixelsPerTick > 10))
            {
                this.View.PixelsPerTick = this.View.PixelsPerTick/2;
            }
            else
            {
                shouldScroll = false;
            }

            //Zoom into the area pointed to by the cursor
            if(shouldScroll)
            {
                this.View.ScrollToPitchTickCenter(cursorTickPosition.x, cursorTickPosition.y);
                this.SetKeyReference(this.TonicKey, this.MusicalModeIndex);
            }

            return;
        }

        //Only allow all selected notes or all unselected notes, depending on the select count.
        //case 1: select count of 0 -> resize all notes
        //case 2: select count != 0 -> resize all selected notes
        function evaluateNoteScrollBehavior(note, selectCount)
        {
            var selected = note.IsSelected;
            var resizeNote = (!selected && (selectCount == 0)) || (selected  && (selectCount > 0))
            var unselectedNotesOnly = !selected;

            return resizeNote
        };

        var firstNotePosition = undefined;
        //Determine if the resize request is valid
        this.ModifyNoteArray(noteArray, function(note)
        {
            var shouldResizeNote = evaluateNoteScrollBehavior(note,selectCount);

            if(shouldResizeNote)
            {
                if(firstNotePosition == undefined)
                {
                    firstNotePosition = note.StartTimeTicks;
                }

                var noteOffset = (note.StartTimeTicks - firstNotePosition);

                if(!shouldScroll)
                {
                    return;
                }

                else
                {
                    if(scrollUp)
                    {
                        shouldScroll = note.Duration <= 8;
                    }
                    else
                    {
                        shouldScroll = (note.Duration > 1)  && ((noteOffset % 2) == 0);
                    }
                }
            }
        });

        firstNotePosition = undefined;
        if(shouldScroll)
        {
            var sequenceNumber = this.GetNextSequenceNumber();

            //Resize all notes as requested. If only one note is selected, treat it like a preview note and change the default preview note size
            this.ModifyNoteArray(noteArray, function(note)
            {
                var newDuration;
                var newPosition;
                var shouldResizeNote = evaluateNoteScrollBehavior(note,selectCount);

                if(shouldResizeNote)
                {
                    if(firstNotePosition == undefined)
                    {
                        firstNotePosition = note.StartTimeTicks;
                        //TODO: Not sure about this yet
                        // if(scrollUp && unselectedNotesOnly && (this.MillisecondsPerTick > 100))
                        // {
                        //     this.MillisecondsPerTick /= 2;
                        // }
                        // else if(!scrollUp && unselectedNotesOnly && (this.MillisecondsPerTick < 1000))
                        // {
                        //     this.MillisecondsPerTick *= 2;
                        // }
                    }

                    var noteOffset = (note.StartTimeTicks - firstNotePosition);

                    if(scrollUp)
                    {
                        newDuration = note.Duration*2;
                        newPosition = firstNotePosition + noteOffset*2;
                    }
                    else
                    {
                        newDuration = note.Duration/2;
                        newPosition = firstNotePosition + noteOffset/2;
                    }

                    //Update the default note duration when the preview note is resized
                    if(selectCount == 1)
                    {
                        this.DefaultNoteDuration = newDuration;
                    }

                    note.HorizontalModify(newPosition, newDuration, sequenceNumber);
                }
            }); //end modify

            this.AnalyzeIntervals(this.Model.Score.NoteArray);
        }
    }

    OnMouseScroll(event)
    {
        var ctrl = event.ctrlKey;
        var alt = event.altKey;
        var shift = event.shiftKey;
        var scrollUp = (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0);

        event.preventDefault();

        //Change horizontal scale
        if(ctrl)
        {
            c_this.HandleControlScroll(scrollUp);
            c_this.View.UpdateExistingNotes(c_this.Model.Score.NoteArray, c_this.NoteColorationMode);
            c_this.View.RenderPlaybackLine(this.MainPlaybackStartTicks,  this.CapturedPlaybackStartTicks);
        }
        else if(shift)
        {
            var xOffset = c_this.DefaultNoteDuration*c_this.View.PixelsPerTick;

			var cursorPosition =
			{
				x:null,
				y:c_this.CursorPosition.y
			}

            if(scrollUp)
            {
                xOffset *= -1;
            }

            var actualXOffset = c_this.View.ScrollHorizontal(xOffset);
			cursorPosition.x = c_this.CursorPosition.x + actualXOffset
			c_this.OnMouseMove(cursorPosition);
        }

        else
        {
            var yOffset = c_this.View.PixelsPerTick;

			var cursorPosition =
			{
				x:c_this.CursorPosition.x,
				y:null
			}

            if(scrollUp)
            {
                yOffset *= -1;
            }

            var actualYOffset = c_this.View.ScrollVertical(yOffset);
			cursorPosition.y = c_this.CursorPosition.y + actualYOffset
			c_this.OnMouseMove(cursorPosition);
        }
    }

    OnRadioButtonPress(eventData)
    {
        var score = c_this.Model.Score.NoteArray;
        var analysisOption = c_this.GetModeSettings(eventData).AnalysisMode;
        c_this.IntervalTranslator = c_this.InvertibleCounterpointIntervals[analysisOption];

        c_this.AnalyzeIntervals(score);
    }
	OnGridClick(gridIndex)
	{
//		c_this.console.log(gridIndex)//todo removed log
		c_this.HandleGridMove(gridIndex);
		c_this.RefreshGridPreview();
		c_this.RefreshGridboxBackground();
	}
    GetNoteRectangle(note)
    {
        var x1Value = this.View.ConvertTicksToXIndex(note.StartTimeTicks);
        var y1Value = this.View.ConvertPitchToYIndex(note.Pitch);
        var gridSnap = this.View.PixelsPerTick;

        var noteRectangle = {
            x1: x1Value,
            y1: y1Value,
            x2: x1Value + note.Duration*gridSnap,
            y2: y1Value + 1*gridSnap
        };

        return noteRectangle;
    }

    GetNoteIndexOfOverlappingNote(cursorRectangle=undefined)
    {
        //Get the index of a clicked note. Return -1 if no notes were clicked
        var clickedNoteIndex = -1;

        if(cursorRectangle == undefined)
        {
            var cursorPosition = this.CursorPosition;
            cursorRectangle =
            {
                x1: cursorPosition.x,
                y1: cursorPosition.y,
                x2: cursorPosition.x,
                y2: cursorPosition.y,
            }
        }
        var score = this.Model.Score.NoteArray;

        //Add one to the start ticks so that the left search is guaranteed include all notes whose durations cover the
        //clicked coordinate
        var startTicks = this.View.ConvertXIndexToTicks(cursorRectangle.x1)+1;
        var sentryNote = new Note(
            startTicks, //ticks
            0,  //pitch
            0,  //duration
            0,  //track
            false);

        var initialGuessIndex = Math.min(this.Model.BinarySearch(score,sentryNote)+1, score.length);
        var searchIndex = initialGuessIndex;

        //Search left for overlaps because notes to the right of this index should start after the target note
        while(searchIndex-- > 0)
        {
            var note = score[searchIndex];
            var noteRectangle = this.GetNoteRectangle(note);
            var noteWasClicked = this.DoesRectangle1OverlapRectangle2(noteRectangle, cursorRectangle);

            if(noteWasClicked)
            {
                clickedNoteIndex = searchIndex;
                break;
            }
        }

        //Return -1 clickednoteIndex if search invalid
        var result =
        {
            ClickedNoteIndex:clickedNoteIndex,
            BinarySearchIndex:initialGuessIndex
        };

        return result;
    }

    DoesRectangle1OverlapRectangle2(rectangle1, rectangle2)
    {
        var xCovered = (rectangle1.x1 <= rectangle2.x2) && (rectangle1.x2 > rectangle2.x1) ;
        var yCovered = (rectangle1.y1 <= rectangle2.y2) && (rectangle1.y2 > rectangle2.y1) ;

        var result = xCovered && yCovered;
        return result;
    }

    DoesRectangle1CoverRectangle2(rectangle1, rectangle2)
    {
        var xCovered = (rectangle1.x1 <= rectangle2.x1) && (rectangle1.x2 >= rectangle2.x2) ;
        var yCovered = (rectangle1.y1 <= rectangle2.y1) && (rectangle1.y2 >= rectangle2.y2) ;

        var result = xCovered && yCovered;
        return result;
    }

    //Calculate the interval associated with each note relative to the bass
    AnalyzeIntervals(noteArray)
    {
        var arrayLength = noteArray.length;
        var noteIndex = 0;
        var chordNotes = [];

		this.ModifyNoteArray(noteArray, function(note)
		{
			note.BassInterval = undefined;
		});

        while(noteIndex < arrayLength)
        {
            //Include suspensions and allow selected notes to be analyzed
            [chordNotes, noteIndex] = this.GetChordNotes(noteArray, noteIndex, true, true);

            var bassNote = chordNotes[0];
            var invertibleNote = chordNotes[chordNotes.length - 1];
            chordNotes.some(function(note)
            {
				if(note.BassInterval == undefined)
				{
					//Upper voice(s)
					if(note.Pitch > bassNote.Pitch)
					{
						var bassInterval = note.Pitch - bassNote.Pitch;
						note.BassInterval = bassInterval % 12;
					}

					//Paired bass note
					else if(
						(note.Pitch == bassNote.Pitch) &&
						(invertibleNote.Pitch != bassNote.Pitch))
					{
						var bassInterval = invertibleNote.Pitch - bassNote.Pitch;
						note.BassInterval = this.IntervalTranslator(bassInterval);
					}
				}

                //unpaired note
                this.View.ApplyNoteStyle(note, this.NoteColorationMode);

            },this);
        }
    }

        	/* analysis suite

        function getNoteArray()
        {
        	var noteArray = [];

        	$(".node").each(function()
        	{
            var pitch = 72-(parseInt($(this).css('top'),10)/snapY);
            var delta = parseInt($(this).css('left'),10)/snapX;
            var duration = parseInt($(this).css('width'),10)/snapX;
            var entry = {'pitch':pitch,'delta':delta,'duration':duration};
            noteArray.push(entry);
            //c_this.console.log(entry);
        	});
        	return noteArray;
        }

        function getIntervalArray()
        {
        	var noteArray = getNoteArray();
        	var temporalDict = {};
        	for(var i =0; i<noteArray.length;i++)
        	{
            noteEntry = noteArray[i];
            delta = noteEntry.delta;
            if(!temporalDict[delta])
            	temporalDict[delta] = [];
            temporalDict[delta].push(noteEntry);
        	}
        	temporaryDict = {};
        	for(var delta in temporalDict)
        	{
            chunk = temporalDict[delta];
            delta = parseInt(delta,10);
            for(var j=0; j<chunk.length;j++)
            {
            	//for each note in the chunk at this moment
            	note = chunk[j];
            	duration = note.duration;

            	while(duration-- > 0)
            	{

                tempDelta = duration+delta;
                if(temporalDict[tempDelta])
                {
                	if(!temporaryDict[tempDelta])
                    temporaryDict[tempDelta] = [];
                	temporaryDict[tempDelta].push(note);
                }
            	}


            }
        	}
        	//merged dict of temporal events
        	//c_this.console.log('temporary: '+JSON.stringify(temporaryDict));
        	//c_this.console.log('main: '+JSON.stringify(temporalDict));

        	for(var delta in temporaryDict)
        	{
            temporaryNoteChunk = temporaryDict[delta];
            temporalNoteChunk = temporalDict[delta];

            if(!temporalDict[delta])
            	temporalDict[delta] = temporaryNoteChunk;
            else
            {
            	for(var i=0;i<temporaryNoteChunk.length;i++)
            	{
                var noteToAdd = temporaryNoteChunk[i]
                var pitchAlreadyPresent = false;
                for(var j=0;j<temporalNoteChunk.length;j++)
                {

                	if(temporalNoteChunk[j].pitch == noteToAdd.pitch)
                    pitchAlreadyPresent = true;
                }
                if(!pitchAlreadyPresent)
                {
                	temporalDict[delta].push(noteToAdd);

                }
            	}
            }
        	}
        	var intervals = []
        	c_this.console.log(JSON.stringify(temporalDict));
        	for(var delta in temporalDict)
        	{
            //If more than 2 entries, just ignore it.. use outer eventually
            if(temporalDict[delta].length == 2)
            	intervals.push(Math.abs(temporalDict[delta][0].pitch - temporalDict[delta][1].pitch));

        	}
        	c_this.console.log(intervals);
        	return intervals;

        }
        function CheckMelody(track)
        {

        }

        function CheckCounterpoint()
        {
        	//Fux's fundamental rules:
        	//Any interval -> Perfect: contrary/oblique

        	//Species:
        	//Strong beat: consonance
        	//1st: 1:1 notes
        	//2nd
        	//3rd
        	//4th

        	//General:
        	//Balance leaps of a fifth or more by going down afterwards
        	//Don't move stepwise into a leap in the same direction
        	//

        	//getNoteArray();
        	var perfectIntervals = new Set([0, 7, 12]); //unison, fifth, octave
        	var imperfectIntervals = new Set([3,4,8,9]); //m3,M3,m6,M6
        	var dissonantIntervals = new Set([1,2,5,6,10,11]);
        	var intervals = getIntervalArray();
        	var directions = getDirectionsArray();
        	var beats = getBeatsArray();
        	var previousStrongBeatInterval = null;
        	for(var i=0; i<intervals.length-1;i++)
        	{
            var oppositeMotion = (directions[i] == 'contrary') || (directions[i] == 'oblique');
            var directMotionToPerfectInterval = (perfectIntervals.has(intervals[i+1]) && !oppositeMotion);
            var parallelPerfectIntervals = perfectIntervals.has(intervals[i+1]) && perfectIntervals.has(intervals[i])

            if(beats[i] == 'strong')
            {
            	var directConsonantBeats = perfectIntervals.has(previousStrongBeatInterval) && perfectIntervals.has(intervals[i]);
            	var strongbeatDissonance = dissonantIntervals.has(intervals[i]);
            	previousStrongBeatInterval = intervals[i];
            }

            if(directMotionToPerfectInterval || strongbeatDissonance || parallelPerfectIntervals)
            {
            	//bad
            }

        	}

        }
        DrawBeats(4);*/

}
