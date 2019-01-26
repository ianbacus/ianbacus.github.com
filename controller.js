var sm = {
    BEGIN: 1,
    SELECTED: 2,
    DRAG: 3
};


var editModeEnumeration = {
	EDIT: 0,
	SELECT: 1,
	DELETE: 2
}

var Modes =
[
    [2,1,2,2,2,1,1,1], //minor
    [2,2,1,2,2,2,1], //major
];

let c_this = undefined;

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
        this.EditModeColors = ['orange','blue','green'];
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

        this.MillisecondsPerTick = 100;
        this.IntervalTranslator = this.InvertibleCounterpointIntervals[0];
		this.CurrentInstrument = null;

		//Recoverable state data
        this.TonicKey = 0;
        this.MusicalModeIndex = 0;
        this.CurrentTrack = 0;
		this.NoteColorationMode = false;
        this.EditorMode = editModeEnumeration.EDIT;

    }

    Initialize(initializationParameters)
    {
		if(initializationParameters != null)
		{
			this.TonicKey = initializationParameters.TonicKey;
			this.MusicalModeIndex = initializationParameters.MusicalModeIndex;
			this.CurrentTrack = initializationParameters.CurrentTrack;
			this.NoteColorationMode = initializationParameters.NoteColorationMode;
			this.EditorMode = initializationParameters.EditorMode;
		}

        //Instruments
        var instrumentOptions = [];
        var instrumentEnumeration = this.Model.InstrumentEnum;
        this.CurrentInstrument = m_this.InstrumentEnum.piano;
        Object.keys(instrumentEnumeration).forEach(function(key) { instrumentOptions.push(key); });
        this.View.PopulateSelectMenu(instrumentOptions);

        //Analysis
        var analysisOption = c_this.GetModeSettings().AnalysisMode;
        c_this.IntervalTranslator = c_this.InvertibleCounterpointIntervals[analysisOption];

        //Main windows
        this.RefreshGridPreview();
        this.SetKeyReference(this.TonicKey, this.MusicalModeIndex);

        var editModeColor = this.EditModeColors[this.EditorMode];
        this.View.SetBorderColor(editModeColor);
    }

	Serialize()
	{
		var serializedData =
		{
			TonicKey: this.TonicKey,
			MusicalModeIndex: this.MusicalModeIndex,
			CurrentTrack: this.CurrentTrack,
			NoteColorationMode: this.NoteColorationMode,
			EditorMode: this.EditorMode,
		}

		return JSON.stringify(serializedData);
	}

    OnSelectChange(instrumentCode)
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

		this.View.RenderKeys(modeBuffer);
    }

    RefreshNotesAndKey()
    {
        this.SetKeyReference(this.TonicKey, this.MusicalModeIndex);
        this.RefreshEditBoxNotes();
    }

    RefreshGridPreview()
    {
        this.RefreshEditBoxNotes();
        this.View.GetGridboxThumbnail(this, this.OnThumbnailRender, this.Model.GridPreviewIndex);
    }

    RefreshEditBoxNotes()
    {
        this.AnalyzeIntervals(this.Model.Score);
        var editModeColor = this.EditModeColors[this.EditorMode];
        this.View.RenderNotes(this.Model.Score, this.NoteColorationMode);
        this.View.RenderPlaybackLine(this.MainPlaybackStartTicks,  this.CapturedPlaybackStartTicks);
    }

    DeleteSelectedNotes(pushAction)
    {
        var i = 0;
        var score = this.Model.Score;
        var sequenceNumber = 0;

        if(pushAction)
        {
            sequenceNumber = this.GetNextSequenceNumber();
        }
        var index = score.length

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
		var maximumSequenceNumber = 10000;//Number.MAX_SAFE_INTEGER-1;
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

            this.Model.AddNote(instantiatedNote, 0, this.Model.Score, false);
        }, this);
    }

    ResetPlaybackStartTicks(ticks)
    {
        this.MainPlaybackStartTicks = ticks;
    }

    OnKeyUp(event)
    {
        var keyupThisPointer = c_this;
        switch(event.keyCode)
        {
        //Mode control: select, edit, delete
        case 88: //"x" key": Select mode
            if(keyupThisPointer.EditorMode != editModeEnumeration.SELECT)
            {
                keyupThisPointer.EditorMode = editModeEnumeration.SELECT;
                var editModeColor = keyupThisPointer.EditModeColors[keyupThisPointer.EditorMode];
                keyupThisPointer.HandleSelectionReset();
                keyupThisPointer.View.SetBorderColor(editModeColor);
            }

            break;
        case 90: //"z" key" undo/redo, Edit mode
            var renderGrid = true;
            //Undo
            if(event.ctrlKey)
            {
                //If a group is being selected, unselect it
                var selectCount = keyupThisPointer.CountSelectedNotes();
                if(selectCount > 1)
                {
                    keyupThisPointer.HandleSelectionReset()
                }
                else
                {
                    keyupThisPointer.Model.Undo();
                    keyupThisPointer.StopPlayingNotes();
                }
            }

            //Redo
            else if(event.shiftKey)
            {
                keyupThisPointer.Model.Redo();
                keyupThisPointer.StopPlayingNotes();
            }

            //Enter edit mode
            else if(keyupThisPointer.EditorMode != editModeEnumeration.EDIT)
            {
                keyupThisPointer.EditorMode = editModeEnumeration.EDIT;
                var editModeColor = keyupThisPointer.EditModeColors[this.EditorMode];
                keyupThisPointer.HandleSelectionReset();
                keyupThisPointer.CreateUniqueEditNote();
                keyupThisPointer.View.SetBorderColor(editModeColor);
            }
            else {
                renderGrid = false;
            }
            if(renderGrid)
            {
                keyupThisPointer.RefreshEditBoxNotes();
            }

            break;
        case 68: //"d" key
            //Delete any selected notes, and enter delete mode
            keyupThisPointer.DeleteSelectedNotes(true);
            keyupThisPointer.RefreshGridPreview()
            break;
        case 9: //tab key
            event.preventDefault();
            var keys = 12;
            if(event.shiftKey)
            {
                keyupThisPointer.TonicKey = (keyupThisPointer.TonicKey+(keys-7))%keys;
            }
            else
            {
                keyupThisPointer.TonicKey = (keyupThisPointer.TonicKey+7)%keys;
            }
            keyupThisPointer.SetKeyReference(keyupThisPointer.TonicKey, keyupThisPointer.MusicalModeIndex);

            break;

		case 75: //"k" key : change coloration mode
			keyupThisPointer.NoteColorationMode = !keyupThisPointer.NoteColorationMode;
			keyupThisPointer.View.UpdateExistingNotes(keyupThisPointer.Model.Score, keyupThisPointer.NoteColorationMode);
			break;

        case 192: //` tilde key: change mode
            keyupThisPointer.MusicalModeIndex = (keyupThisPointer.MusicalModeIndex+1) % Modes.length;
            keyupThisPointer.SetKeyReference(keyupThisPointer.TonicKey, keyupThisPointer.MusicalModeIndex);
            break;

        case 32: //spacebar
            event.preventDefault();

            if(!keyupThisPointer.Playing)
            {
                var playbackBuffer = []
				keyupThisPointer.HandleSelectionReset();

                //Find note closest to playback coordinate
                //Shift space: reset the play index to the last captured point
                if(event.shiftKey)
                {
                    keyupThisPointer.ResetPlaybackStartTicks(keyupThisPointer.CapturedPlaybackStartTicks);
                }

                //Ctrl space: reset play index to beginning of grid
                else if(event.ctrlKey)
                {
                    keyupThisPointer.ResetPlaybackStartTicks(0);
                    keyupThisPointer.CapturedPlaybackStartTicks = keyupThisPointer.MainPlaybackStartTicks;
                }

                //Regular space: overwrite the last captured point and play from wherever the playback cursor is
                else
                {
                    keyupThisPointer.CapturedPlaybackStartTicks = keyupThisPointer.MainPlaybackStartTicks;
                }

                var score = keyupThisPointer.Model.Score;
                var playbackStartXCoordinate = keyupThisPointer.View.ConvertTicksToXIndex(keyupThisPointer.MainPlaybackStartTicks);

                var selectionRectangle =
                {
                    x1: playbackStartXCoordinate,
                    y1: 0,
                    x2: playbackStartXCoordinate,
                    y2: 'Infinity',
                };

                //
                var searchResult = keyupThisPointer.GetNoteIndexOfOverlappingNote(selectionRectangle);
                var [searchIndex, binarySearchResult] = [searchResult.ClickedNoteIndex, searchResult.BinarySearchIndex]

                //Handle case where playback cursor is before any notes
                if((searchIndex < 0) && (binarySearchResult < score.length))
                {
                    searchIndex = binarySearchResult-1;
                }
                if(searchIndex >= 0)
                {
                    //Add all unselected notes after the playback index to the playback buffer
                    var [playbackBuffer,x] = keyupThisPointer.GetChordNotes(score, searchIndex, false);
                    for(searchIndex; searchIndex<score.length;searchIndex++)
                    {
                        var note = score[searchIndex];
                        if(!note.IsSelected)
                        {
                            playbackBuffer.push(note);
                        }
                    }

                    keyupThisPointer.PlayNotes(playbackBuffer, false);
                }

            }
            else
            {
                keyupThisPointer.StopPlayingNotes();
            }
            break;

        case 67: //"c" key"
            var copyBuffer = [];

            //Copy all selected notes into a buffer
            keyupThisPointer.ModifyNoteArray(keyupThisPointer.Model.SelectedNotes, function(noteToCopy)
            {
                copyBuffer.push(noteToCopy);
            });

            keyupThisPointer.PasteBuffer = keyupThisPointer.PreparePasteBuffer(copyBuffer);
            keyupThisPointer.InstantiatePasteBuffer(keyupThisPointer.PasteBuffer);

            keyupThisPointer.RefreshEditBoxNotes();
            break;

        case 86: //"v" key

            keyupThisPointer.InstantiatePasteBuffer(keyupThisPointer.PasteBuffer);
            keyupThisPointer.RefreshGridPreview();
            break;

        case 65: //"a key"
            //ctrl+a: select all
            if(keyupThisPointer.EditorMode != editModeEnumeration.SELECT)
            {
                keyupThisPointer.EditorMode = editModeEnumeration.SELECT;
                keyupThisPointer.HandleSelectionReset();
            }
            if(event.ctrlKey)
            {
                event.preventDefault();
                keyupThisPointer.ModifyNoteArray(keyupThisPointer.Model.Score, function(note)
                {
                    note.IsSelected = true;
                    this.View.ApplyNoteStyle(note, this.NoteColorationMode);
                });
            }

        case 81: //"q" key
            break;

        //Numeric keys
        case 49: //key 0
        case 50: //key 1
        case 51: //...
        case 52:
        case 53:
        case 54:
        case 55: //...
        case 56: //key 8
        case 57: //key 9
            var pressedKey = event.keyCode - 49;
            keyupThisPointer.CurrentTrack = pressedKey;

            keyupThisPointer.ModifyNoteArray(keyupThisPointer.Model.SelectedNotes, function(note)
            {
                note.CurrentTrack = keyupThisPointer.CurrentTrack;
                this.View.ApplyNoteStyle(note, this.NoteColorationMode);
            });
            break;

        case 69: //"e" key: invert bass down octave
        case 87: //"w" key: Invert bass up octave

            var analysisMode = keyupThisPointer.GetModeSettings().AnalysisMode;
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
            if(event.keyCode == 69)
            {
                bassOffset = analysisOffset;
                upperVoiceOffset = 12;
			}

            keyupThisPointer.ModifyNoteArray(keyupThisPointer.Model.SelectedNotes, function(candidateNote)
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
				(highestNewPosition <= keyupThisPointer.View.MaximumPitch);

			var lowerBoundCheck =
				(0 < lowestNewPosition) &&
				(lowestNewPosition <= keyupThisPointer.View.MaximumPitch);

			if(lowerBoundCheck && upperBoundCheck)
			{
				const topTrack = noteWithHighestPitch.CurrentTrack;
				const bassTrack = noteWithLowestPitch.CurrentTrack;

				keyupThisPointer.ModifyNoteArray(keyupThisPointer.Model.SelectedNotes, function(note)
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

            break;

        case 82: //"r" key:  Add new grid
            keyupThisPointer.Model.CreateGridPreview();
            keyupThisPointer.RefreshGridPreview();
            break;
        case 38: //up arrow: select grid
            event.preventDefault();
            keyupThisPointer.HandleGridMove(true);
            keyupThisPointer.RefreshGridPreview();
            break;
        case 40: //down arrow: select grid
            event.preventDefault();
            keyupThisPointer.HandleGridMove(false);
            keyupThisPointer.RefreshGridPreview();
            break;
        }
    }

    HandleGridMove(upwardsDirection)
    {
        var moveFunction;
        var copyBuffer = [];
        var newGridIndex;

        if(upwardsDirection)
        {
            moveFunction = this.Model.GotoPreviousGrid;
            newGridIndex = Math.max(this.Model.GridPreviewIndex-1, 0);
        }

        else
        {
            moveFunction = this.Model.GotoNextGrid;
            newGridIndex = Math.min(this.Model.GridPreviewIndex+1, this.Model.GridPreviewList.length-1);
        }

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
        moveFunction.call(this.Model);

        //Instantiate the copied notes in the next buffer
        copyBuffer.forEach(function(note)
        {
            this.console.log("Transporting note: ", note, newGridIndex);
			note.CurrentGridIndex = newGridIndex;
            this.Model.AddNote(note, 0, this.Model.Score, false);
            this.Model.AddNote(note, 0, this.Model.SelectedNotes, false);
        },this);

        this.console.log("Transport end");

    }

    GetNextUnselectedNote()
    {
        var note = null;

        //Get the next note that isn't selected
        while(this.NoteIndex < this.Model.Score.length)
        {
            var note = this.Model.Score[this.NoteIndex ];

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
        this.View.ApplyNoteStyle(note, this.NoteColorationMode)
	}

    PlayChord(noteArray, noteIndex, includeSuspensions)
    {
        //Get all notes that play during this note, return the index of the first note that won't be played in this chord
        var [chordNotes,returnIndex] = this.GetChordNotes(noteArray, noteIndex, includeSuspensions)

        this.ModifyNoteArray(chordNotes, function(note)
        {
            note.Play(this.MillisecondsPerTick, this, this.OnStopNote, this.CurrentInstrument);
            this.View.ApplyNoteStyle(note, this.NoteColorationMode);
        });

        return returnIndex;
    }

    OnPlayAllNotes(includeSuspensions=false)
    {
        var playbackNoteArray = this.PlaybackNoteArray;
        const noteIndex = this.NoteIndex;
        const currentNote = playbackNoteArray[noteIndex];
        const nextNoteIndex = this.PlayChord(playbackNoteArray, noteIndex, includeSuspensions);

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

    PlayNotes(noteArray, includeSuspensions)
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

            this.OnPlayAllNotes(includeSuspensions);
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
            var startTicks = this.View.ConvertXIndexToTicks(this.CursorPosition.x);
            var pitch = this.View.ConvertYIndexToPitch(this.CursorPosition.y);
            var noteIsSelected = true;
            var previewNote = new Note(
                startTicks,
                pitch,
                this.DefaultNoteDuration,
                this.CurrentTrack,
                true);

            this.Model.AddNote(previewNote, 0, this.Model.Score, false);
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
				this.Model.DeleteNote(note, 0, this.Model.Score, false);
                this.View.DeleteNotes([note]);
			}
        }, false);

        this.AnalyzeIntervals(this.Model.Score);
        this.View.UpdateExistingNotes(this.Model.Score, this.NoteColorationMode);
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

				mouseMoveThisPointer.ModifyNoteArray(mouseMoveThisPointer.Model.Score, function(note)
				{
					var noteRectangle = mouseMoveThisPointer.GetNoteRectangle(note);
					var noteIsCaptured = mouseMoveThisPointer.DoesRectangle1CoverRectangle2(selectRectangle, noteRectangle);

					if(noteIsCaptured)
					{
						note.IsSelected = true;
					}

					else
					{
						note.IsSelected = false;
					}
                    this.View.ApplyNoteStyle(note, this.NoteColorationMode);
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
                mouseMoveThisPointer.Model.MergeSort(mouseMoveThisPointer.Model.Score);
                mouseMoveThisPointer.AnalyzeIntervals(mouseMoveThisPointer.Model.Score);

			}
		}
    } //end OnMouseMove

    HandleIndividualNotePlayback(noteIndex, playbackMode)
    {
        var score = this.Model.Score;
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

		event.preventDefault();
        if(clickdownThisPointer.EditorMode == editModeEnumeration.SELECT)
        {
            var selectCount = clickdownThisPointer.CountSelectedNotes();
            var clickedNoteIndex = clickdownThisPointer.GetNoteIndexOfOverlappingNote().ClickedNoteIndex;
            var score = clickdownThisPointer.Model.Score;

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
        var clickUpThisPointer = c_this;

        event.preventDefault();
        clickUpThisPointer.StopPlayingNotes();

		var selectedNotes = clickUpThisPointer.Model.SelectedNotes;
        var mainScore = clickUpThisPointer.Model.Score;
        var selectCount = clickUpThisPointer.CountSelectedNotes();
        var wasSelectingGroup = clickUpThisPointer.SelectingGroup === true;

        clickUpThisPointer.Model.MergeSort(clickUpThisPointer.Model.Score);
        clickUpThisPointer.Model.MergeSort(clickUpThisPointer.Model.SelectedNotes);

        if(wasSelectingGroup)
        {
            clickUpThisPointer.View.DeleteSelectRectangle();
            clickUpThisPointer.SelectingGroup = false;
            if(selectCount === 0)
            {
                var clickupTicks = clickUpThisPointer.View.ConvertXIndexToTicks(clickUpThisPointer.CursorPosition.x);
                clickUpThisPointer.ResetPlaybackStartTicks(clickupTicks);
            }
        }

        else
        {
			var playbackBuffer = [];
            var playbackMode = clickUpThisPointer.GetModeSettings().PlaybackMode;
            var sequenceNumber = clickUpThisPointer.GetNextSequenceNumber();
            var includeSuspensions = playbackMode == 2;

			//Play all intersecting chords and handle move completion. If playback mode == 0 (solo),
            //do not search for intersecting chords.
            if((selectCount > 0) && (playbackMode != 0))
            {
                const selectedBufferEndIndex = selectedNotes.length-1;
                const firstSelectedNote = selectedNotes[0];
                const startTickBoundary = firstSelectedNote.StartTimeTicks;
                const endTickBoundary =
                    selectedNotes[selectedBufferEndIndex].StartTimeTicks +
                    selectedNotes[selectedBufferEndIndex].Duration;

                //Find all notes in the score that intersect with the selected notes
                clickUpThisPointer.ModifyNoteArray(clickUpThisPointer.Model.Score, function(note)
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
    		                clickUpThisPointer.Model.AddNote(note, 0, playbackBuffer, false);
                        }

                        else if(suspendsOverFirstNote)
                        {
                            var suspendDummyNote = new Note(
                                firstSelectedNote.StartTimeTicks,
                                note.Pitch,
                                firstSelectedNote.Duration,
                                firstSelectedNote.CurrentTrack,
                                false);
    		                clickUpThisPointer.Model.AddNote(suspendDummyNote, 0, playbackBuffer, false);
                        }
                     }
                });
            }

            //Push all selected notes to the playback buffer, unselect them to place them and handle
            //move completion. Reverse iterate to allow deselection, which removes notes from the
            //selectedNotes buffer

            clickUpThisPointer.ModifyNoteArray(selectedNotes, function(note)
            {
                clickUpThisPointer.Model.AddNote(note, 0, playbackBuffer, false);
                note.IsSelected = false;
                note.OnMoveComplete(sequenceNumber);
                this.View.ApplyNoteStyle(note, this.NoteColorationMode);
				console.log("Clicked note: ", note)
            }, false);


            //Move the playback line
            if(playbackBuffer.length > 0)
            {
                clickUpThisPointer.ResetPlaybackStartTicks(playbackBuffer[0].StartTimeTicks);
            }

            //Chords
            if(playbackMode == 1)
            {
                clickUpThisPointer.PlayNotes(playbackBuffer,false);
            }

            //Suspensions and chords
            else
            {
                clickUpThisPointer.PlayNotes(playbackBuffer,true);
            }
        }

        clickUpThisPointer.CreateUniqueEditNote();
        clickUpThisPointer.View.RenderPlaybackLine(clickUpThisPointer.MainPlaybackStartTicks,  clickUpThisPointer.CapturedPlaybackStartTicks);

    } //end OnMouseClickUp

    //Resize notes
    HandleControlScroll(scrollUp)
    {
        var shouldScroll = true;
        var selectCount = this.CountSelectedNotes();
        var noteArray = this.Model.Score;

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
            });
            this.AnalyzeIntervals(this.Model.Score);
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
            c_this.View.UpdateExistingNotes(c_this.Model.Score, c_this.NoteColorationMode);
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
        var score = c_this.Model.Score;
        var analysisOption = c_this.GetModeSettings(eventData).AnalysisMode;
        c_this.IntervalTranslator = c_this.InvertibleCounterpointIntervals[analysisOption];

        c_this.AnalyzeIntervals(score);
    }

    GetNoteRectangle(note)
    {
        var x1Value = this.View.ConvertTicksToXIndex(note.StartTimeTicks);
        var y1Value = this.View.ConvertPitchToYIndex(note.Pitch);
        var gridSnap = this.View.PixelsPerTick;

        var noteRectangle = {
            x1: x1Value,
            y1: y1Value,
            x2: x1Value+note.Duration*gridSnap,
            y2: y1Value+1*gridSnap
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
        var score = this.Model.Score;

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
