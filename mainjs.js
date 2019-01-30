class disabledConsole
{
    constructor() {}
    log() {} //Do nothing
};

let ScoreView = new View();
let ScoreModel = new Model();
let ScoreController = new Controller(ScoreView,ScoreModel);
let TheMidiAbstractionLayer = new MidiAbstractionLayer();

ScoreView.console = new disabledConsole();
ScoreModel.console = new disabledConsole();
ScoreController.console = new disabledConsole();


  /**
   * Variables.
   */
  var contextMenuClassName = "context-menu";
  var contextMenuItemClassName = "context-menu__item";
  var contextMenuLinkClassName = "context-menu-link";
  var contextMenuActive = "context-menu--active";

  var taskItemClassName = "task";
  var taskItemInContext;

  var clickCoords;
  var clickCoordsX;
  var clickCoordsY;

  var menu; 
  var menuItems;
  var menuState = 0;
  var menuWidth;
  var menuHeight;
  var menuPosition;
  var menuPositionX;
  var menuPositionY;

  var windowWidth;
  var windowHeight;

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
            var array = MidiParser.parse(midiData);
            TheMidiAbstractionLayer.ParseMidiFile(array);

            $(".loader").show();

            setTimeout(function()
            {
                var score = TheMidiAbstractionLayer.ConvertPitchDeltasToScoreModel();
                if(score.length > 0)
                {
                    var lastNote = score[score.length-1];
                    var lastTick = lastNote.StartTimeTicks + lastNote.Duration;

                    ScoreView.GridWidthTicks = lastTick;
                    ScoreModel.Score = score;
                    ScoreModel.MergeSort(ScoreModel.Score);

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
	
	
	
	/////////////////////////////////////////////////////////////////
	
  var menu = document.querySelector("#context-menu");
  var menuItems = menu.querySelectorAll(".context-menu__item");
  /**
   * Function to check if we clicked inside an element with a particular class
   * name.
   * 
   * @param {Object} e The event
   * @param {String} className The class name to check against
   * @return {Boolean}
   */
  function clickInsideElement( e, className ) {
    var el = e.srcElement || e.target;
    
    if ( el.classList.contains(className) ) {
      return el;
    } else {
      while ( el = el.parentNode ) {
        if ( el.classList && el.classList.contains(className) ) {
          return el;
        }
      }
    }

    return false;
  }

  /**
   * Get's exact position of event.
   * 
   * @param {Object} e The event passed in
   * @return {Object} Returns the x and y position
   */
  function getPosition(e) {
    var posx = 0;
    var posy = 0;

    if (!e) var e = window.event;
    
    if (e.pageX || e.pageY) {
      posx = e.pageX;
      posy = e.pageY;
    } else if (e.clientX || e.clientY) {
      posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
      posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }

    return {
      x: posx,
      y: posy
    }
  }

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////
  //
  // C O R E    F U N C T I O N S
  //
  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////
   /**
   * Function to check if we clicked inside an element with a particular class
   * name.
   * 
   * @param {Object} e The event
   * @param {String} className The class name to check against
   * @return {Boolean}
   */
  function clickInsideElement( e, className ) {
    var el = e.srcElement || e.target;
    
    if ( el.classList.contains(className) ) {
      return el;
    } else {
      while ( el = el.parentNode ) {
        if ( el.classList && el.classList.contains(className) ) {
          return el;
        }
      }
    }

    return false;
  }

  /**
   * Get's exact position of event.
   * 
   * @param {Object} e The event passed in
   * @return {Object} Returns the x and y position
   */
  function getPosition(e) {
    var posx = 0;
    var posy = 0;

    if (!e) var e = window.event;
    
    if (e.pageX || e.pageY) {
      posx = e.pageX;
      posy = e.pageY;
    } else if (e.clientX || e.clientY) {
      posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
      posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }

    return {
      x: posx,
      y: posy
    }
}


  /**
   * Initialise our application's code.
   */
  function init() {
    contextListener();
    clickListener();
    keyupListener();
    resizeListener();
  }

  /**
   * Listens for contextmenu events.
   */
  function contextListener() {
    document.addEventListener( "contextmenu", function(e) {
      taskItemInContext = clickInsideElement( e, taskItemClassName );

		console.log("contextmenu", taskItemInContext);
      if ( taskItemInContext ) {
        e.preventDefault();
        toggleMenuOn();
        positionMenu(e);
      } else {
        taskItemInContext = null;
        toggleMenuOff();
      }
    });
  }

  /**
   * Listens for click events.
   */
  function clickListener() {
    document.addEventListener( "click", function(e) {
		console.log("click");
      var clickeElIsLink = clickInsideElement( e, contextMenuLinkClassName );

      if ( clickeElIsLink ) {
        e.preventDefault();
        menuItemListener( clickeElIsLink );
      } else {
        var button = e.which || e.button;
        if ( button === 1 ) {
          toggleMenuOff();
        }
      }
    });
  }

  /**
   * Listens for keyup events.
   */
  function keyupListener() {
    window.onkeyup = function(e) {
      if ( e.keyCode === 27 ) {
        toggleMenuOff();
      }
    }
  }

  /**
   * Window resize event listener
   */
  function resizeListener() {
    window.onresize = function(e) {
      toggleMenuOff();
    };
  }

  /**
   * Turns the custom context menu on.
   */
  function toggleMenuOn() {
    if ( menuState !== 1 ) {
      menuState = 1;
      menu.classList.add( contextMenuActive );
    }
  }

  /**
   * Turns the custom context menu off.
   */
  function toggleMenuOff() {
    if ( menuState !== 0 ) {
      menuState = 0;
      menu.classList.remove( contextMenuActive );
    }
  }

  /**
   * Positions the menu properly.
   * 
   * @param {Object} e The event
   */
  function positionMenu(e) {
    clickCoords = getPosition(e);
    clickCoordsX = clickCoords.x;
    clickCoordsY = clickCoords.y;

    menuWidth = menu.offsetWidth + 4;
    menuHeight = menu.offsetHeight + 4;

    windowWidth = window.innerWidth;
    windowHeight = window.innerHeight;

    if ( (windowWidth - clickCoordsX) < menuWidth ) {
      menu.style.left = windowWidth - menuWidth + "px";
    } else {
      menu.style.left = clickCoordsX + "px";
    }

    if ( (windowHeight - clickCoordsY) < menuHeight ) {
      menu.style.top = windowHeight - menuHeight + "px";
    } else {
      menu.style.top = clickCoordsY + "px";
    }
  }

  /**
   * Dummy action function that logs an action when a menu item link is clicked
   * 
   * @param {HTMLElement} link The link that was clicked
   */
  function menuItemListener( link ) {
    //console.log( "Task ID - " + taskItemInContext.getAttribute("data-id") + ", Task action - " + link.getAttribute("data-action"));
    toggleMenuOff();
  }

  /**
   * Run the app.
   */
  init();
	
	/////////////////////////////////////////////////////////////////

    ScoreModel.Initialize(deserializedModelData);
    ScoreView.Initialize(
		deserializedViewData,
        ScoreController,
        ScoreController.OnKeyPress,
        ScoreController.OnMouseScroll,
        ScoreController.OnMouseMove, ScoreController.OnMouseClickUp, ScoreController.OnMouseClickDown,
        ScoreController.OnHoverBegin, ScoreController.OnHoverEnd,
        ScoreController.OnSliderChange, ScoreController.OnSelectChange,
        OnPageUnload,
        ScoreController.OnRadioButtonPress,
    );

    ScoreController.Initialize(deserializedControllerData);

    $(".loader").hide();

    TheMidiAbstractionLayer.Initialize();

    //$("#gridbox").addEventListener("dragenter", function(e)
    $(document).on('dragstart','#testDZ', function(e)
    {
        console.log("start")
        lastTarget = e.target; // cache the last target here
        // unhide our dropzone overlay
        document.querySelector("#testDZ").style.visibility = "";
        document.querySelector("#testDZ").style.opacity = 1;
    });

    $(document).on("dragleave", '#testDZ', function(e)
    {
        // this is the magic part. when leaving the window,
        // e.target happens to be exactly what we want: what we cached
        // at the start, the dropzone we dragged into.
        // so..if dragleave target matches our cache, we hide the dropzone.
        console.log("leave")
        if(e.target === lastTarget || e.target === document)
        {
            document.querySelector("#testDZ").style.visibility = "hidden";
            document.querySelector("#testDZ").style.opacity = 0;
            console.log("c")
        }
    });

    // $("#testDZ").dropzone({
    //   url: "/file-upload",
    //   clickable: false
    // });
    var TheDropzone = new Dropzone("#testDZ",
    {
          url: "/file-upload",
          clickable: false
    });

    $("#testDZ").addClass("dropzone");

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
                    var tabResultData = TheMidiAbstractionLayer.GenerateTab();

                    if(tabResultData.failureReason == undefined)
                    {
                        makeTextFile(tabResultData.tablatureString);
                    }

                    else
                    {
                        alert(tabResultData.failureReason)
                    }

                    $(".loader").hide();
                }
            }, 10);
			return false;
		});

});
