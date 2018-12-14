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

//TODO: build emscript with -s EXIT_RUNTIME=1
// ScoreView.console = console;
// ScoreModel.console = console;
//ScoreController.console = console;
var activeNotesMappedToTheirStartTick = {};
var TickToPitchMidiValueDictionary = {};
var timeSignatureEvents = {}
var MaximumNotesPerBeat = 8.0;
var ParseString ='';
var TabberMethod;
var PitchLookupTable = {"c0":12,"d0":14,"e0":16,"f0":17,"g0":19,"a0":21,"b0":23};


function ProcessNote(pitchMidiValue, currentTimeTicks, isNoteOff, track)
{
    //Note on events: add the pitch information to the intermediate file for rendering in the tab
    var pitchMidiValueEntry =
    {
		Type:'Note',
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
    var metaEvent = 255;

    var trackNumber = 0;

    activeNotesMappedToTheirStartTick = {};
    TickToPitchMidiValueDictionary = {};
    timeSignatureEvents = {}

    tracks.forEach(function(trackObject)
    {
        var track = trackObject.event;
        var trackAbsoluteTime = 0;

        var currentEventTickValue = 0

        //console.log("Track",trackNumber)
        track.forEach(function(midiEvent)
        {
            var noteDelta = midiEvent.deltaTime;
            var noteData = midiEvent.data;
            var noteType = midiEvent.type;

            trackAbsoluteTime += noteDelta;
            var noteAbsoluteStartTime = trackAbsoluteTime;

            var currentEventTickValue =  2*(noteAbsoluteStartTime*(MaximumNotesPerBeat/timeDivision))
            currentEventTickValue = Math.round(currentEventTickValue)

            if((noteType == noteOnEvent) || (noteType == noteOffEvent))
            {
                var pitch = midiEvent.data[0];
                var noteOffVelocityZero = midiEvent.data[1] < 0.65;
                var isNoteOff = noteOffVelocityZero || (noteType == noteOffEvent);

                ProcessNote(pitch, currentEventTickValue, isNoteOff, trackNumber)
            }

			else if(noteType = metaEvent)
			{
				var metaEventType = midiEvent.metaType;

				//Time signature
				if(metaEventType == 0x58)
				{
					var timeSigString = noteData[0]+","+noteData[1]
					var pitchMidiValueEntry =
					{
						Type:'TimeSignature',
						Data:timeSigString,
					}
					timeSignatureEvents[currentEventTickValue] = timeSigString;
				}
			}
        }, trackAbsoluteTime);

        trackNumber++;

    }, trackNumber);
}

function ParsePitchDeltas()
{
    ParseString = '';
    var tickInstanceKeyList = [];

    Object.keys(TickToPitchMidiValueDictionary).forEach(function(currentTicks)
    {
        tickInstanceKeyList.push(parseInt(currentTicks));
    });

    var lastTick = tickInstanceKeyList[tickInstanceKeyList.length-1];
    tickInstanceKeyList.push(lastTick+4);
    for(var index = 0; index<tickInstanceKeyList.length-1; index++)
    {
        var currentTicks = tickInstanceKeyList[index];
        var nextTicks = tickInstanceKeyList[index+1];
        var delta = nextTicks - currentTicks;

        var pitchList = TickToPitchMidiValueDictionary[currentTicks];

		Object.keys(timeSignatureEvents).forEach(function(timeSignatureTick)
		{
			if(timeSignatureTick == currentTicks)
			{
				var resString = 'SIGEVENT\r\n' + timeSignatureEvents[timeSignatureTick] + '\r\n';
				ParseString += resString;
			}
		},currentTicks, ParseString);

        pitchList.sort(function(a,b) { return a.Pitch - b.Pitch;});
        pitchList.forEach(function(pitchDuration)
        {
            var pitch = pitchDuration.Pitch;
            var duration = pitchDuration.Duration;
            var track = pitchDuration.Track;

            var resString = pitch+ "," +delta+ "," +track+ "," +duration + "\r\n";
            delta = 0;
            ParseString += resString;

        },delta);
    }
}

function ConvertPitchDeltasToScoreModel()
{
    var score = [];

    Object.keys(TickToPitchMidiValueDictionary).forEach(function(currentTicks)
    {
        var pitchList = TickToPitchMidiValueDictionary[currentTicks];
        pitchList.forEach(function(pitchDuration)
        {
            var startTimeTicks = parseInt(currentTicks);
            var pitch = parseInt(pitchDuration.Pitch);
            var duration = parseInt(pitchDuration.Duration);
            var track = parseInt(pitchDuration.Track);

            var note = new Note(
                startTimeTicks,
                pitch,
                duration,
                track,
                false);

            score.push(note);

        }, currentTicks);
    });

    $(".loader").hide();

    return score;
}

function GenerateTab(event)
{
    var tuningPitches = [23, 28, 33, 38, 43, 47,52];
    var tuningStrings = "BEADGBe";
    //var tuningPitches = [28, 33, 38, 43, 47, 52];
    //var tuningStrings = "eadgbe";

    ParsePitchDeltas();

    var failure = undefined;

    if(ParseString.length > 0)
    {
		var frets = $('#frets').val();;
		var neckCost = $('#neckCost').val();// 1500;
		var spanCost = $('#spanCost').val();// 3000;
		var diffCost = $('#diffCost').val();// 7500;
		var sustainCost = $('#sustainCost').val();// 1000;
		var arpeggioCost = $('#arpeggioCost').val();// 1000;
		var columnFormat = $('#screenLength').val();// 250;
		var transpose = $('#transpose').val();// 250;
		var instrumentStrings = $('#strings').val();// 250;

		var tuningPitches = []
		var tuningStrings = "";

		var splitInstrumentStrings = instrumentStrings.split(',');
		splitInstrumentStrings.some(function(stringName)
		{
			var stringNameTruncated = stringName[0];
			var stringPitch = PitchLookupTable[stringName];

            if(stringPitch == undefined)
            {
                failure = "Invalid tuning string " + instrumentStrings;
                console.log(failure,splitInstrumentStrings);
                return;
            }

			tuningPitches.push(stringPitch);
			tuningStrings += stringNameTruncated;

		},tuningPitches, tuningStrings);

    }

    else
    {
        failure = "Please provide a midi file"
    }

    if(failure == undefined)
    {
        var outString = TabberMethod(
			ParseString,
			tuningStrings,
			tuningPitches,
            transpose,
			frets,
			neckCost,
			spanCost,
			diffCost,
			sustainCost,
			arpeggioCost,
			columnFormat);

        // var outStringPtr = TabberMethod(... var outString = Pointer_stringify(outStringPtr);
		// makeTextFile(outString);
		// free(outStringPtr)

		makeTextFile(outString);
	}

	else
	{
		alert(failure)
	}

    $(".loader").hide();

	return false;
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
            var array = MidiParser.parse(midiData);
            ParseMidiFile(array);
        });

        reader.readAsArrayBuffer(file);

    },

    init: function()
    {
        this.on("addedfile", function()
        {
            if (this.files[1]!=null)
            {
                this.removeFile(this.files[0]);
            }
        });
    }
};

var textFile = null;
function makeTextFile(text)
{
    var data = new Blob([text], {type: 'text/plain'});

    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.

    window.URL.revokeObjectURL(textFile);
    textFile = window.URL.createObjectURL(data);
	window.open(textFile);

    // returns a URL you can use as a href
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

        return false;
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

	TabberMethod = Module.cwrap('javascriptWrapperFunction', 'string',
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
            'number',
    ]);

    var pitches = ['c','d','e','f','g','a','b'];

    for(var octaveOffset=1; octaveOffset<8; octaveOffset++)
    {
        var offset = octaveOffset*12;

        pitches.forEach(function(pitch)
        {
            var basePitchKey = pitch+'0';
            var newPitchKey = pitch+octaveOffset;
            var basePitch = PitchLookupTable[basePitchKey];
            var newPitch = basePitch + offset;

            PitchLookupTable[newPitchKey] = newPitch;
        }, octaveOffset);
    }

    $(".loader").hide();

    //$(document).on('submit', '#TabSettingsForm',
    $('#TabSettingsForm .midi-form-button').click(
		function(event)
		{
            $(".loader").show();
			event.preventDefault();
            var buttonName = $(this).attr("name");
            console.log(buttonName);

            setTimeout(function()
            {
                //console.log(buttonName);
                if(buttonName == "tab")
                {
                    GenerateTab();
                }

                else if(buttonName == "import")
                {
                    var score = ConvertPitchDeltasToScoreModel();
                    if(score.length > 0)
                    {
                        var lastNote = score[score.length-1];
                        var lastTick = lastNote.StartTimeTicks + lastNote.Duration;

                        ScoreView.GridWidthTicks = lastTick;
                        ScoreModel.Score = score;
                        ScoreModel.MergeSort(ScoreModel.Score);

                        ScoreController.RefreshNotesAndKey();
                    }
                }
            }, 10, buttonName);
			return false;
		});

});
