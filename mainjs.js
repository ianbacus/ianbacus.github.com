class disabledConsole
{
    constructor() {}
    log() {} //Do nothing
};

let ScoreView = new View();
let ScoreModel = new Model();
let ScoreController = new Controller(ScoreView,ScoreModel);

ScoreView.console = new disabledConsole();
ScoreModel.console = new disabledConsole();
ScoreController.console = new disabledConsole();


// ScoreView.console = console;
// ScoreModel.console = console;
//ScoreController.console = console;
var activeNotesMappedToTheirStartTick = {};
var TickToPitchMidiValueDictionary = {};
var MaximumNotesPerBeat = 8.0;

function ProcessNote(pitchMidiValue, currentTimeTicks, isNoteOff, track)
{
    //Note on events: add the pitch information to the intermediate file for rendering in the tab
    var pitchMidiValueEntry =
    {
        Pitch:pitchMidiValue,
        Track:track,
        Duration:0,
    };

    //Note off events: update the durations of notes as they expire
    if(isNoteOff)
    {
        var tickValueOfActiveNote = activeNotesMappedToTheirStartTick[pitchMidiValue]
        var durationOfActiveNote = currentTimeTicks-tickValueOfActiveNote

        var entryIndex = 0;
        try
        {
            TickToPitchMidiValueDictionary[tickValueOfActiveNote].forEach(function(testPitchMidiValueEntry)
            {
                if(testPitchMidiValueEntry.Pitch == pitchMidiValue)
                {
                    var fixedDuration = Math.min(durationOfActiveNote,(MaximumNotesPerBeat*6));
                    TickToPitchMidiValueDictionary[tickValueOfActiveNote][entryIndex].Duration =fixedDuration;
                }
                entryIndex++;
            }, TickToPitchMidiValueDictionary);
        }
        catch(e)
        {
            console.log(pitchMidiValue, currentTimeTicks, isNoteOff)
            console.log(e, TickToPitchMidiValueDictionary, activeNotesMappedToTheirStartTick, tickValueOfActiveNote)
        }

    }

    //Note on events:
    else
    {
        activeNotesMappedToTheirStartTick[pitchMidiValue] = currentTimeTicks

        try
        {
            TickToPitchMidiValueDictionary[currentTimeTicks].push(pitchMidiValueEntry)
        }
        catch(e)
        {
            TickToPitchMidiValueDictionary[currentTimeTicks] = [pitchMidiValueEntry]
        }
    }
}


function ParseMidiFile(midiFileObject)
{
    var timeDivision = midiFileObject.timeDivision;
    var tracks = midiFileObject.track;
    var noteOnEvent = 9;
    var noteOffEvent = 8;

    var trackNumber = 0;
    tracks.forEach(function(trackObject)
    {
        var track = trackObject.event;
        var trackAbsoluteTime = 0;

        var currentEventTickValue = 0

        track.forEach(function(midiEvent)
        {
            var noteDelta = midiEvent.deltaTime;
            var noteData = midiEvent.data;
            var noteType = midiEvent.type;

            trackAbsoluteTime += noteDelta;
            var noteAbsoluteStartTime = trackAbsoluteTime;

            var currentEventTickValue =  2*(noteAbsoluteStartTime*(MaximumNotesPerBeat/timeDivision))
            currentEventTickValue = Math.round(currentEventTickValue)

            //Time signature events are added to a separate data structure
            //if type(midiEvent) is midi.events.TimeSignatureEvent:
                //timeSignatureEvents[currentEventTickValue] = midiEvent.get_numerator(),midiEvent.get_denominator()

            if((noteType == noteOnEvent) || (noteType == noteOffEvent))
            {
                var pitch = midiEvent.data[0];
                var noteOffVelocityZero = midiEvent.data[1] < 1.0;
                var isNoteOff = noteOffVelocityZero || (noteType == noteOffEvent);

                ProcessNote(pitch, currentEventTickValue, isNoteOff, trackNumber)
            }
        }, trackAbsoluteTime);

        trackNumber++;

    }, trackNumber);

    var parseString = '';

    var lastDeltaKey = 0;
    Object.keys(TickToPitchMidiValueDictionary).forEach(function(deltaKey) {
        var pitchList = TickToPitchMidiValueDictionary[deltaKey];
        var delta = undefined;
        pitchList.sort(function(a,b) { return a.Pitch - b.Pitch;});
        pitchList.forEach(function(pitchDuration)
        {
            var pitch = pitchDuration.Pitch;
            var duration = pitchDuration.Duration;
            var track = pitchDuration.Track;

            if(delta == undefined)
            {
                delta = deltaKey - lastDeltaKey;
                lastDeltaKey = deltaKey;
                var resString = pitch+ "," +delta+ "," +track+ "," +duration + "\r\n";
            }
            else
            {
                var resString = pitch+ "," +0+ "," +track+ "," +duration + "\r\n";
            }
            parseString += resString;
        },parseString, delta);

    }, parseString,lastDeltaKey);

    var tabberMethod = Module.cwrap('javascriptWrapperFunction', 'string',
        [
            'string',
            'string',
            'array',
            'number',
            'number',
            'number',
            'number',
            'number',
            'number',
            'number',
    ]);
    
    var tuningPitches = [23, 28, 33, 38, 43, 47,52];
    var tuningStrings = "BEADGBe";
    //var tuningPitches = [28, 33, 38, 43, 47, 52];
    //var tuningStrings = "eadgbe";

    var fileData = parseString;
    var frets = 10;
    var neckCost = 1500;
    var spanCost = 3000;
    var diffCost = 7500;
    var sustainCost = 1000;
    var arpeggioCost = 1000;
    var columnFormat = 250;

    var outString = tabberMethod(
        fileData,
        tuningStrings,
        tuningPitches,
        frets,
        neckCost,
        spanCost,
        diffCost,
        sustainCost,
        arpeggioCost,
        columnFormat);

    window.open(makeTextFile(outString));
}

Dropzone.options.importDropzone = {
    paramName: "file", // The name that will be used to transfer the file
    maxFilesize: 2, // MB
    accept: function(file, done)
    {
        var reader = new FileReader();

        // Closure to capture the file information.
        reader.onload = (function(event)
        {
            var midiData = new Uint8Array(event.target.result);
            console.log(midiData);
            var array = MidiParser.parse(midiData);
            ParseMidiFile(array);
        });

        reader.readAsArrayBuffer(file);

    }
};

var textFile = null;
function makeTextFile(text)
{
    var data = new Blob([text], {type: 'text/plain'});

    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.
    if (textFile !== null) {
        window.URL.revokeObjectURL(textFile);
    }

    textFile = window.URL.createObjectURL(data);


    // returns a URL you can use as a href
    return textFile;
};

$( function()
{
	var modelLocalStorageString = "ianbacus.github.io.saves";
	var viewLocalStorageString = "ianbacus.github.io.viewdata";
	var controllerLocalStorageString = "ianbacus.github.io.state";

    var deserializedModelData = JSON.parse(localStorage.getItem(modelLocalStorageString));
	var deserializedViewData = JSON.parse(localStorage.getItem(viewLocalStorageString));
	var deserializedControllerData = JSON.parse(localStorage.getItem(controllerLocalStorageString));

    function OnPageUnload()
    {
        localStorage.setItem(modelLocalStorageString,ScoreModel.Serialize());
		localStorage.setItem(viewLocalStorageString,ScoreView.Serialize());
		localStorage.setItem(controllerLocalStorageString,ScoreController.Serialize());

        return true;
    }

    ScoreModel.Initialize(deserializedModelData);
    ScoreView.Initialize(
		deserializedViewData,
        ScoreController,
        ScoreController.OnKeyUp,
        ScoreController.OnMouseScroll,
        ScoreController.OnMouseMove, ScoreController.OnMouseClickUp, ScoreController.OnMouseClickDown,
        ScoreController.OnHoverBegin, ScoreController.OnHoverEnd,
        ScoreController.OnSliderChange, ScoreController.OnSelectChange,
        OnPageUnload,
        ScoreController.OnRadioButtonPress,
    );

    ScoreController.Initialize(deserializedControllerData);

});
