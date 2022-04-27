class disabledConsole
{
    constructor() {}
    log() {} //Do nothing
};

let ScoreView = new View();
let ScoreModel = new Model();
let ScoreController = new Controller(ScoreView,ScoreModel);
let TheMidiAbstractionLayer = new MidiAbstractionLayer();
let GridboxContextMenuHandler = new ContextMenuHandler();

ScoreView.console = new disabledConsole();
ScoreModel.console = new disabledConsole();
ScoreController.console = new disabledConsole();

var lastTarget = 0

//TODO: build emscript with -s EXIT_RUNTIME=1
// ScoreView.console = console;
// ScoreModel.console = console;
//ScoreController.console = console;

///Directory
/*
controller
    UI: Grid, note manipulation, selection rectangles, form handlers, track mode control, harmony analysis

mainJS: dropzone, subscriptions, initialization
midiApi: midi export and import, tab generation
view: highlighting, coloring, rendering notes, playback animation, menu population
model: Notes, Scores, sorting, undo/redo,
Harmony analysis
*/

var dropzoneChordMap = {};
var dropzoneMetaEventMap = {};
Dropzone.autoDiscover = false;
Dropzone.options.testDZ = {
    url: "/file-upload",
    paramName: "file", // The name that will be used to transfer the file
    maxFilesize: 200, // MB
    maxFiles: 1,
    acceptedFiles: ".mid,.MID",
    accept: function(file, done)
    {
        var reader = new FileReader();

        // Closure to capture the file information.
        reader.onload = (function(event)
        {
            var midiData = new Uint8Array(event.target.result);
            dropzoneChordMap = {}
            dropzoneMetaEventMap = {}
            TheMidiAbstractionLayer.ParseMidiFileToChordMap(midiData, dropzoneChordMap, dropzoneMetaEventMap);

            $(".loader").show();

            setTimeout(function()
            {
                var scoreModel = TheMidiAbstractionLayer.ConvertPitchDeltasToScoreModel(dropzoneChordMap);

				score = scoreModel.noteBuffer;
				trackList = scoreModel.tracks;
				console.log(score)
				if(score.length > 0)
                {
                    var lastNote = score[score.length-1];
                    var lastTick = lastNote.StartTimeTicks + lastNote.Duration;

                    ScoreView.GridWidthTicks = lastTick;
                    ScoreModel.Score.NoteArray = score;
                    ScoreModel.MergeSort(ScoreModel.Score.NoteArray);

                    ScoreController.RefreshNotesAndKey();
                    ScoreController.UpdateTracks(trackList);
                }
            }, 20);
			return false;
		});

        reader.readAsArrayBuffer(file);
    },

    init: function()
    {
        this.on("complete", function(file)
        {
            console.log("success")
          $(".dz-success-mark svg").css("background", "green");
          $(".dz-error-mark").css("display", "none");
      });

        this.on("addedfile", function(file)
        {
            this.removeFile(file);
        });

    }
};

//todo: why is this here? scope?
var textFile = null;
function OpenTextFileInNewTab(guitarTabString)
{
    var data = new Blob([guitarTabString], {type: 'text/plain'});


    window.URL.revokeObjectURL(textFile);
    textFile = window.URL.createObjectURL(data);
	window.open(textFile);
};

function ExportScoreToMidiFile()
{
    //Generate midi data from score
    var score = ScoreModel.Score.NoteArray;
    var fileName = "browser_composition.mid";
    TheMidiAbstractionLayer.ExportMidiNotes(score,fileName);

}

function GenerateTablatureFromCanvas()
{
    //Set a timeout so the loader has time to appear after clicking the button.
    //When hte timeout occurs (as short as possible) then run the expensive tab
    //generation function, block for a few ms.
    setTimeout(function()
    {
        var score = ScoreModel.Score.NoteArray;
        var tabResultData = TheMidiAbstractionLayer.GenerateTabFromCanvas(score);

        console.log(tabResultData);

        $("#tabberContainer").empty().append(tabResultData.tablatureString);//.replace(/\s/g, '&nbsp;'));
        if(tabResultData.failureReason == undefined)
        {
            // OpenTextFileInNewTab(tabResultData.tablatureString);
        }

        else
        {
            alert(tabResultData.failureReason)
        }

        tabResultData = null;

        $(".loader").hide();
    }, 10);
}

function OnContextMenuSelection(selection)
{
    switch(selection)
    {
        // Gridbox
        case "GenerateTab":
            $(".loader").show();
            GenerateTablatureFromCanvas();
            break;
        case "ExportMidi":
            ExportScoreToMidiFile();
            break;
        case "SelectNotes":
            ScoreController.SelectAllNotes();
            break;
        case "DeleteNotes":
            ScoreController.SelectAllNotes();
            ScoreController.DeleteSelectedNotes(true);
            ScoreController.RefreshGridPreview()
            break;
        // Canvas array
        case "DeleteCanvas":
            ScoreModel.DeleteGridPreview();
            ScoreController.RefreshGridPreview();
            break;
        case "InsertCanvas":
            ScoreModel.CreateGridPreview();
            ScoreController.RefreshGridPreview();
            break;
        default:
            break;
    }
}

$( function()
{
	var modelLocalStorageString = "ianbacus.github.io.saves";
	var viewLocalStorageString = "ianbacus.github.io.viewdata";
	var controllerLocalStorageString = "ianbacus.github.io.state";

    try {
        var modelData = localStorage.getItem(modelLocalStorageString);
        var viewData = localStorage.getItem(viewLocalStorageString);
        var controllerData = localStorage.getItem(controllerLocalStorageString);

    	var deserializedViewData = JSON.parse(viewData );
    	var deserializedControllerData = JSON.parse(controllerData);
        var deserializedModelData = JSON.parse(modelData);

    } catch (e) {
        console.log(e);
        var deserializedModelData = undefined;
    	var deserializedViewData = undefined;
    	var deserializedControllerData = undefined;
    }

    function OnPageUnload()
    {
        localStorage.setItem(modelLocalStorageString,ScoreModel.Serialize());
		localStorage.setItem(viewLocalStorageString,ScoreView.Serialize());
		localStorage.setItem(controllerLocalStorageString,ScoreController.Serialize());

        return false;
    }

    GridboxContextMenuHandler.Initialize(OnContextMenuSelection);
    TheMidiAbstractionLayer.Initialize();

    ScoreModel.Initialize(deserializedModelData);
    ScoreView.Initialize(
		deserializedViewData,
        ScoreController,
        ScoreController.OnKeyPress,
        ScoreController.OnMouseScroll,
        ScoreController.OnMouseMove, ScoreController.OnMouseClickUp, ScoreController.OnMouseClickDown,
        ScoreController.OnHoverBegin, ScoreController.OnHoverEnd,
        ScoreController.OnSliderChange,
        ScoreController.OnTrackSliderChange, ScoreController.OnTrackSelectChange, ScoreController.OnTrackButton,
        OnPageUnload, ScoreController.OnRadioButtonPress,
		ScoreController.OnGridClick
    );

    ScoreController.Initialize(deserializedControllerData);

    $(".loader").hide();
    // .mousemove(this.OnMouseMove)
    // .mousedown(onMouseClickDown)
    // .mouseup(onMouseClickUp)
    // .mouseenter(onHoverBegin)
    // .mouseleave(onHoverEnd)

    $(".trackrow").mouseenter(
        function(e)
        {

        }).mouseleave(
        function(e)
        {

        });

	$(document).on(".trackrow click", ".trackrow", function(e)
    {
        var trackNumber = parseInt(this.attributes["value"].value);
        ScoreController.CurrentTrack = trackNumber;
    });

    //$("#GridboxArray").mousedown(function(){console.log("controller: go to grid view");});

    $(document).on('dragstart','#fileDropZone', function(e)
    {
        console.log("start")
        lastTarget = e.target;

        document.querySelector("#fileDropZone").style.visibility = "";
        document.querySelector("#fileDropZone").style.opacity = 1;
    });

    $(document).on("dragleave", '#fileDropZone', function(e)
    {
        if(e.target === lastTarget || e.target === document)
        {
            document.querySelector("#fileDropZone").style.visibility = "hidden";
            document.querySelector("#fileDropZone").style.opacity = 0;
        }
    });

    var TheDropzone = new Dropzone("#fileDropZone",
    {
          url: "/file-upload",
          clickable: false
    });

    $("#fileDropZone").addClass("dropzone");

    //$(document).on('submit', '#TabSettingsForm',
    $('#TabSettingsForm .midi-form-button').click(function(event)
	{
		event.preventDefault();
        var buttonName = $(this).attr("name");

        if(buttonName == "tab")
        {
            $(".loader").show();
            GenerateTablatureFromCanvas();
        }

		return false;
	});

});
