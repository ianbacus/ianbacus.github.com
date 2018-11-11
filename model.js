let m_this = undefined;

var InstrumentEnum = {
	Violin: 0,
	Guitar: 1,
	Flute: 2
};

class Note
{
    constructor(startTimeTicks, pitch, duration, selected, currentGridIndex=m_this.GridPreviewIndex)
    {
        //State information
        this.Pitch = pitch;
        this.StartTimeTicks = startTimeTicks;
        this.Duration = duration;
        this.CurrentGridIndex = currentGridIndex;

        //State meta-data
        this.StateWhenSelected = null
        this.SelectedGridIndex = m_this.GridPreviewIndex;
        this._IsSelected = selected;

        //If a note is created and selected, append it to the selected notes buffer
        if(selected)
        {
            m_this.AddNote(this, 0, m_this.SelectedNotes, false);
        }

        //Display and analysis information
        this.IsHighlighted = false;
        this.BassInterval = undefined;

    }

    Move(x_offset, y_offset)
    {
        this.StartTimeTicks += x_offset;
        this.Pitch += y_offset;

    }

    Play(millisecondsPerTick, caller, onStopCallback, instrumentCode=InstrumentEnum.Guitar)
    {
        var milliseconds = millisecondsPerTick * this.Duration

        var env;
        var synth;
        switch(instrumentCode)
        {
            //TODO: improve instruments
            case InstrumentEnum.Violin:
                env = T("perc", {a:655, r:milliseconds*1.5});
                synth  = T("PluckGen", {env:env, mul:0.75}).play();
                break;

            case InstrumentEnum.Guitar:
                env = T("perc", {a:100, r:milliseconds*1.0});
                synth  = T("PluckGen", {env:env, mul:0.75}).play();
                break;

            case InstrumentEnum.Flute:
                //fami, saw, tri, pulse, konami, cos, sin
                var table = [10,
                    [10, milliseconds/10], [50, milliseconds/9], [100, milliseconds/8],
                    [50, milliseconds/7], [150, milliseconds/6], [200, milliseconds/5],
                    [150, milliseconds/4], [100, milliseconds/3], [50, milliseconds/2],
                    [10, milliseconds]];
                //env   = T("env", {table:table, loopNode:0}).bang();
                env = T("perc", {a:450, ar:false, r:milliseconds*1.0});
                synth = T("OscGen", {env:env, wave: "cos", mul: 0.075 }).play();
                break;

            default:
                env = T("perc", {a:5, r:milliseconds*1.0});
                synth  = T("PluckGen", {env:env, mul:0.75}).play();
                break;
        }
        synth.noteOn(this.Pitch, 200);
		this.OnStopCallback = {Caller:caller, Callback: onStopCallback};
        this.IsHighlighted = true;

        this.PendingTimeout = setTimeout(
            $.proxy(this.StopPlaying, this),milliseconds);
    }

    StopPlaying()
    {
        this.IsHighlighted = false;
		this.OnStopCallback.Callback.call(this.OnStopCallback.Caller);
    }

    HorizontalModify(startTime,duration, sequenceNumber)
    {
        var initialState = this.CaptureState();

        this.Duration = duration;
        this.StartTimeTicks = startTime;
        if(!this.IsSelected)
        {
            var currentState = this.CaptureState();

            m_this.PushAction({
                Action:'MODIFY',
                SequenceNumber:sequenceNumber,
                GridIndex:m_this.GridPreviewIndex,
                MoveBuffer:[],
                MoveData:{
                    Note:this,
                    OriginalState:initialState,
                    TargetState:currentState
                }
            });
        }
    }

    OnMoveComplete(sequenceNumber)
    {
        var currentState = this.CaptureState();

        if(this.StateWhenSelected == null)
        {
            m_this.PushAction({
                Action:'ADD',
                SequenceNumber:sequenceNumber,
                GridIndex:m_this.GridPreviewIndex,
                MoveBuffer:[],
                MoveData:{
                    Note:this
                }
            });
        }

        else if(!this.StatesAreEqual(currentState, this.StateWhenSelected))
        {
            m_this.PushAction({
                Action:'MODIFY',
                SequenceNumber:sequenceNumber,
                GridIndex:m_this.GridPreviewIndex,
                MoveBuffer:[],
                MoveData:{
                    Note:this,
                    OriginalState:this.StateWhenSelected,
                    TargetState:currentState
                }
            });
        }

        this.StateWhenSelected = null;
    }

    StatesAreEqual(state1, state2)
    {
        var exactMatch =
            (state1.Pitch === state2.Pitch) &&
            (state1.StartTimeTicks === state2.StartTimeTicks) &&
            (state1.Duration === state2.Duration) &&
            (state1.GridIndex === state2.GridIndex);

        return exactMatch;
    }

    CaptureState()
    {
        var capturedState =
        {
            Pitch : this.Pitch,
            StartTimeTicks : this.StartTimeTicks,
            Duration : this.Duration,
            GridIndex : this.CurrentGridIndex
        }

        return capturedState;
    }

    RestoreState(capturedState)
    {
        var currentGridIndex = this.CurrentGridIndex;
        var selectedGridIndex = capturedState.GridIndex;

        if(currentGridIndex != selectedGridIndex)
        {
            this.HandleGridMoveReset(currentGridIndex,selectedGridIndex);
        }

        this.Pitch = capturedState.Pitch;
        this.StartTimeTicks = capturedState.StartTimeTicks;
        this.Duration = capturedState.Duration;
        this.CurrentGridIndex = selectedGridIndex;

        this.StateWhenSelected = null;
    }

    ResetPosition()
    {
        if(this.StateWhenSelected != null)
        {
            this.RestoreState(this.StateWhenSelected);
        }
    }

    set IsSelected(selected)
    {
        //When selecting an unselected note, capture its state
        if(this._IsSelected != selected)
        {
            if(selected)
            {
                this.StateWhenSelected = this.CaptureState();
                m_this.AddNote(this, 0, m_this.SelectedNotes, false);
                m_this.console.log("Added SELECT note, captured state ", this, m_this.SelectedNotes.length)
            }

            else
            {
                m_this.DeleteNote(this, 0, m_this.SelectedNotes, false);
                m_this.console.log("Deleted SELECT note ",m_this.SelectedNotes.length)
            }

            this._IsSelected = selected;
        }

    }

    get IsSelected()
    {
        return this._IsSelected;
    }

	HandleGridMoveReset(currentGridIndex,selectedGridIndex)
	{
		var selectStartGridBuffer = m_this.GridPreviewList[selectedGridIndex];
		var currentGridBuffer = m_this.GridPreviewList[currentGridIndex];

		m_this.DeleteNote(this, 0, currentGridBuffer, false);
		m_this.AddNote(this, 0, selectStartGridBuffer, false);
	}
};

class Model
{
    constructor()
    {
        m_this = this;
        this.Score = [];
        this.GridPreviewList = [this.Score];
        this.GridImageList = [null]
        this.GridPreviewIndex = 0;
        this.ActivityStack = []
        this.ActivityIndex = 0;
        this.MaximumActivityStackLength = 100;
        this.SelectedNotes = [];
    }

    SetCurrentGridPreview(noteArray)
    {
        this.GridPreviewList[this.GridPreviewIndex] = noteArray;
    }

    GotoPreviousGrid()
    {
        if(this.GridPreviewIndex > 0)
        {
            this.GridPreviewIndex--;
            this.Score = this.GridPreviewList[this.GridPreviewIndex];
        }
    }

    GotoNextGrid()
    {
        if(this.GridPreviewIndex < this.GridPreviewList.length-1)
        {
            this.GridPreviewIndex++;
            this.Score = this.GridPreviewList[this.GridPreviewIndex];
        }
    }

    CreateGridPreview()
    {
        this.GridPreviewList.push([]);
        this.GridImageList.push([]);
    }

    SortScoreByTicks()
    {
        //this.Score.sort(this.CompareNotes);
        this.MergeSort(this.Score);
    }

    HandleBatchInsertion(activityStack, action, targetString)
    {
        var stackLength = activityStack.length;
        var pushSuccessful = false;

        if((action.Action === targetString) && (stackLength > 0))
        {
            var stackTop = activityStack[stackLength - 1];

            //If this move is part of the same sequence number's move, combine it with the top of the stack
            if(stackTop.SequenceNumber == action.SequenceNumber)
            {
                stackTop.MoveBuffer.push(action.MoveData);
                pushSuccessful = true;
                this.console.log(
					"Group "+action.Action + ": " +
					stackTop.MoveBuffer.length + " datums")
            }
        }

        return pushSuccessful;

    } //end HandleBatchInsertion

    PushAction(action)
    {
        var activityStack = this.ActivityStack;
        var stackLength = this.ActivityStack.length;
        var actionCases = ["MODIFY", "ADD", "DELETE"]
        var pushSuccessful = false;

        //If the index doesn't point to the end of the stack, dump all changes
        if(this.ActivityIndex != stackLength-1)
        {
            var resetIndex = this.ActivityIndex+1;
            this.console.log(
				"Resetting stack up to and including index "+resetIndex);
            this.ActivityStack = this.ActivityStack.slice(0,resetIndex);
        }

        //Lose the last action if the stack is full
        if(stackLength >= this.MaximumActivityStackLength)
        {
            this.console.log(
				"Maximum undo length reached. Discarding old state information.")
            this.ActivityStack.shift();
        }

        //Check all cases
        actionCases.some(function(caseString)
        {
            //If a group of actions are happening, push them together
            var pushedToBatch = this.HandleBatchInsertion(activityStack, action, caseString);

            //Exit after a successful case is reached, since an event only can have one case
            if(pushedToBatch)
            {
                pushSuccessful = true;
                return;
            }
        }, this);

        //If a distinct move is happening, push it separately
        if(!pushSuccessful)
        {
            action.MoveBuffer.push(action.MoveData);
            this.ActivityStack.push(action)
            this.console.log(
				"Distinct "+action.Action +
				". New stack length: "+this.ActivityStack.length);
        }

        this.ActivityIndex = this.ActivityStack.length - 1;

		this.console.log(
			"Push complete." +
			"Activity stack index: "+
			this.ActivityIndex+ "/"+(this.ActivityStack.length-1));

    } //end PushAction

    Undo()
    {
        if(this.ActivityIndex >= 0)
        {
            var mostRecentAction = this.ActivityStack[this.ActivityIndex];
            var moveBuffer = mostRecentAction.MoveBuffer;
            var gridBuffer = this.GridPreviewList[mostRecentAction.GridIndex];

            this.console.log(
				"Undoing " + mostRecentAction.Action +
				" on " + moveBuffer.length +
				" notes, actionID = " + mostRecentAction.SequenceNumber);

            this.ActivityIndex--;

            //Undo the addition of a note by deleting it
            if(mostRecentAction.Action === 'ADD')
            {
                moveBuffer.forEach(function(moveData)
                {
                    var note = moveData.Note;
                    this.DeleteNote(note, 0, gridBuffer, false)
                },this);
            }

            //Undo the deletion of a note by adding it
            else if(mostRecentAction.Action === 'DELETE')
            {
                moveBuffer.forEach(function(moveData)
                {
                    var note = moveData.Note;
                    this.AddNote(note,  0, gridBuffer, false)
                }, this);
            }

            //Undo a move by moving in the opposite direction
            else if(mostRecentAction.Action === 'MODIFY')
            {
                moveBuffer.forEach(function(moveData)
                {
                    var note = moveData.Note;
                    var state = moveData.OriginalState;
                    note.RestoreState(state);
                });

				//gridBuffer.sort(this.CompareNotes);
                this.MergeSort(gridBuffer);
            }

            this.console.log(
				"Undo complete." +
				"Activity stack index: "+
				this.ActivityIndex+ "/"+(this.ActivityStack.length-1));
        }

    }

    Redo()
    {
        if(this.ActivityIndex < this.ActivityStack.length-1)
        {
            this.ActivityIndex++;
            var mostRecentAction = this.ActivityStack[this.ActivityIndex]
            var moveBuffer = mostRecentAction.MoveBuffer;
            var gridBuffer = this.GridPreviewList[mostRecentAction.GridIndex];

            this.console.log(
				"Redoing " + mostRecentAction.Action +
				" on " + moveBuffer.length +
				" notes, actionID = " + mostRecentAction.SequenceNumber);

            //Redo addition
            if(mostRecentAction.Action === 'ADD')
            {
                moveBuffer.forEach(function(moveData)
                {
                    var note = moveData.Note;
                    this.AddNote(note, 0, gridBuffer, false)
                }, this);
            }

            //Redo deletion
            else if(mostRecentAction.Action === 'DELETE')
            {
                moveBuffer.forEach(function(moveData)
                {
                    var note = moveData.Note;
                    this.DeleteNote(note, 0, gridBuffer, false)
                }, this);
            }

            //Redo a move
            else if(mostRecentAction.Action === 'MODIFY')
            {
                moveBuffer.forEach(function(moveData)
                {
                    var note = moveData.Note;
                    var state = moveData.TargetState;
                    note.RestoreState(state);
                }, this);

				//gridBuffer.sort(this.CompareNotes);
                this.MergeSort(gridBuffer);
            }

            this.console.log("Redo complete. Activity stack index: "+ this.ActivityIndex+"/"+(this.ActivityStack.length-1));
        }
    }

    CompareNotes(note1, note2)
    {
        function assertInt1GreaterThanInt2(int1, int2)
        {
            if(int1 === int2) { return 0; }
            if(int1 > int2) { return 1; }
            else if(int1 < int2) { return -1; }
        }

        //Same note
        if(note1 === note2)
        {
            return 0;
        }

        else
        {
            var compareResult = assertInt1GreaterThanInt2(note1.CurrentGridIndex, note2.CurrentGridIndex);

            if(compareResult === 0)
            {
                compareResult = assertInt1GreaterThanInt2(note1.StartTimeTicks, note2.StartTimeTicks);
                if(compareResult === 0)
                {
                    compareResult = assertInt1GreaterThanInt2(note1.Pitch, note2.Pitch);
                    if(compareResult === 0)
                    {
                        compareResult = assertInt1GreaterThanInt2(note1.Duration, note2.Duration);
                        if(compareResult === 0)
                        {
                            compareResult = 1; //Not an exact match, just put one first
                        }

                    }
                }
            }
        }

        return compareResult;

    } //end CompareNotes

    //Determine the index of an element or the index where an element should be inserted using an
    //iterative binary search and a compare predicate
    BinarySearch(array, note, compare_fn=this.CompareNotes)
    {
        var lowerIndex = 0;
        var upperIndex = array.length - 1;
        var pivotIndex = (upperIndex + lowerIndex) >> 1;
        var returnIndex = 0;

        while (lowerIndex <= upperIndex)
        {
            //Get index of middle element of range
            pivotIndex = (upperIndex + lowerIndex) >> 1;
            var pivotNote = array[pivotIndex];

            //Compare note against middle element
            var compareResult = this.CompareNotes(note, pivotNote);

            //Note > pivot: change lower bound to middle+1 to search right half
            if (compareResult > 0)
            {
                var newLowerBound = pivotIndex + 1;
                lowerIndex = newLowerBound;
                returnIndex = newLowerBound;
            }

            //Note < pivot: change upper bound to middle-1 to search left half
            else if(compareResult < 0)
            {
                var newUpperBound = pivotIndex - 1;
                upperIndex = newUpperBound;
                returnIndex = newUpperBound;
            }

            //Note == pivot: return index
            else
            {
                returnIndex = pivotIndex;
                return returnIndex;
            }
        }

        //Return 0 instead of -1 when the return index indicates the correct location is before the first element (0)
        returnIndex = Math.max(0,returnIndex);
        return returnIndex;

    }

    MergeSort(array, comparefn=this.CompareNotes)
    {
        function merge(arr, aux, lo, mid, hi, comparefn)
        {
            var i = lo;
            var j = mid + 1;
            var k = lo;
            while(true)
            {
                  var cmp = comparefn(arr[i], arr[j]);
                  if(cmp <= 0)
                  {
                      aux[k++] = arr[i++];
                      if(i > mid)
                      {
                          do
                          {
                              aux[k++] = arr[j++];
                          }  while(j <= hi);
                          break;
                      }
                  }
                  else
                  {
                      aux[k++] = arr[j++];
                      if(j > hi)
                      {
                          do
                          {
                            aux[k++] = arr[i++];
                          }  while(i <= mid);
                          break;
                      }
                  }
              }
          }

        function sortarrtoaux(arr, aux, lo, hi, comparefn)
        {
            if (hi < lo)
                return;
            if (hi == lo)
            {
                aux[lo] = arr[lo];
                return;
            }

            var mid = Math.floor(lo + (hi - lo) / 2);
            sortarrtoarr(arr, aux, lo, mid, comparefn);
            sortarrtoarr(arr, aux, mid + 1, hi, comparefn);
            merge(arr, aux, lo, mid, hi, comparefn);
        }

        function sortarrtoarr(arr, aux, lo, hi, comparefn)
        {
            if (hi <= lo) return;
            var mid = Math.floor(lo + (hi - lo) / 2);
            sortarrtoaux(arr, aux, lo, mid, comparefn);
            sortarrtoaux(arr, aux, mid + 1, hi, comparefn);
            merge(aux, arr, lo, mid, hi, comparefn);
        }

        function merge_sort(arr, comparefn)
        {
            var aux = arr.slice(0);
            sortarrtoarr(arr, aux, 0, arr.length - 1, comparefn);
            return arr;
        }

        return merge_sort(array, comparefn);
    }

    InsertSorted(array, note)
    {
        var index = this.BinarySearch(array, note, this.CompareNotes);

        array.splice( index, 0, note );
    }

    //Public
    AddNote(note, sequenceNumber, array=this.Score, pushAction=true)
    {
        var gridIndex = this.GridPreviewIndex;

        if(pushAction)
        {
            this.PushAction({
                Action:'ADD',
                SequenceNumber:sequenceNumber,
                GridIndex:this.GridPreviewIndex,
                MoveBuffer:[],
                MoveData:{
                    Note:note
                }
            });
        }

        this.InsertSorted(array, note);
    }

    DeleteNoteWithIndex(deletionIndex, sequenceNumber, array=this.Score, pushAction=true)
    {
        var numberOfDeletions = 1;
        var deletedNote = array[deletionIndex];
        var gridIndex = this.GridPreviewIndex;

        if((array===this.Score) && (deletedNote.IsSelected))
        {
            this.DeleteNote(deletedNote, 0, this.SelectedNotes, false);
        }

        if(pushAction)
        {
			deletedNote.ResetPosition();
			deletedNote.IsSelected = false;
            this.PushAction({
                Action:'DELETE',
                SequenceNumber:sequenceNumber,
                GridIndex:this.GridPreviewIndex,
                MoveBuffer:[],
                MoveData:{
                    Note:deletedNote
                }
            });
        }

        array.splice(deletionIndex, numberOfDeletions)
    }

    DeleteNote(note, sequenceNumber, array=this.Score, pushAction=true)
    {
		//var deletionIndex = this.BinarySearch(array, note, this.CompareNotes, true);

        var deletionIndex = 0;
        var index = 0;

        array.some(function(candidate)
        {
            if(candidate == note)
            {
                deletionIndex = index;
                return;
            }
            else
            {
                index++;
            }
        });

        this.DeleteNoteWithIndex(deletionIndex,sequenceNumber,array,pushAction)
    }
};
