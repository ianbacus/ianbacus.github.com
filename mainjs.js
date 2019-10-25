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

  /**
   * Variables
   */


//TODO: build emscript with -s EXIT_RUNTIME=1
// ScoreView.console = console;
// ScoreModel.console = console;
//ScoreController.console = console;

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

            //console.log(array, midiData);
            //TheMidiAbstractionLayer.ParseMidiFile(array);
            TheMidiAbstractionLayer.ParseMidiFile(midiData);

            $(".loader").show();

            setTimeout(function()
            {
                var score = TheMidiAbstractionLayer.ConvertPitchDeltasToScoreModel();
                if(score.length > 0)
                {
                    var lastNote = score[score.length-1];
                    var lastTick = lastNote.StartTimeTicks + lastNote.Duration;

                    ScoreView.GridWidthTicks = lastTick;
                    ScoreModel.Score.NoteArray = score;
                    ScoreModel.MergeSort(ScoreModel.Score.NoteArray);

                    ScoreController.RefreshNotesAndKey();
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
function OpenTextFileInNewTab(text)
{
    var data = new Blob([text], {type: 'text/plain'});

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

function OnContextMenuSelection(selection)
{
    switch(selection)
    {
        case "Export":
            ExportScoreToMidiFile();
            break;
        case "Select":
            ScoreController.SelectAllNotes();
            break;
        case "Delete":
            ScoreController.SelectAllNotes();
            ScoreController.DeleteSelectedNotes(true);
            ScoreController.RefreshGridPreview()
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
    );

    ScoreController.Initialize(deserializedControllerData);

    $(".loader").hide();

        // .mousemove(this.OnMouseMove)
        // .mousedown(onMouseClickDown)
        // .mouseup(onMouseClickUp)
        // .mouseenter(onHoverBegin)
        // .mouseleave(onHoverEnd)
    $(".trackrow").mouseenter(function(e){console.log("track: hello")}).mouseleave(function(e){console.log("track: goodbye")});
    $(".gridCanvas").mouseenter(function(){console.log("controller: go to grid view");});
    //$("#GridboxArray").mousedown(function(){console.log("controller: go to grid view");});

    $(document).on('dragstart','#testDZ', function(e)
    {
        console.log("start")
        lastTarget = e.target;

        document.querySelector("#testDZ").style.visibility = "";
        document.querySelector("#testDZ").style.opacity = 1;
    });

    $(document).on("dragleave", '#testDZ', function(e)
    {
        if(e.target === lastTarget || e.target === document)
        {
            document.querySelector("#testDZ").style.visibility = "hidden";
            document.querySelector("#testDZ").style.opacity = 0;
        }
    });

    var TheDropzone = new Dropzone("#testDZ",
    {
          url: "/file-upload",
          clickable: false
    });

    $("#testDZ").addClass("dropzone");

    //$(document).on('submit', '#TabSettingsForm',
    $('#TabSettingsForm .midi-form-button').click(function(event)
	{
        $(".loader").show();
		event.preventDefault();
        var buttonName = $(this).attr("name");

        if(buttonName == "tab")
        {
            //Set a timeout so the loader has time to appear after clicking the button
            setTimeout(function()
            {
                var score = ScoreModel.Score.NoteArray;
                var tabResultData = TheMidiAbstractionLayer.GenerateTabFromCanvas(score);

                console.log(tabResultData.tablatureString)
                if(tabResultData.failureReason == undefined)
                {
                    OpenTextFileInNewTab(tabResultData.tablatureString);
                }

                else
                {
                    alert(tabResultData.failureReason)
                }

                $(".loader").hide();
            }, 10);
        }

		return false;
	});

});
