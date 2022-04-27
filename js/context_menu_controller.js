class ContextMenu
{
    constructor(menuIdName, targetIdName, targetClassName)
    {
        this.ContextMenuClassName = "context-menu";
        this.ContextMenuItemClassName = "context-menu__item";
        this.ContextMenuLinkClassName = "context-menu__link";
        this.ContextMenuActive = "context-menu--active";
        this.MenuState = 0;
        this.MenuIdName = menuIdName;
        this.TargetIdName = targetIdName;
        this.TargetClassName = targetClassName;
        this.ContextMenuElement;
        this.GridboxElement;
        this.menuItems;
    }

    Initialize(onContextMenuSelectionCallback)
    {
        this.ContextMenuElement = document.querySelector(this.MenuIdName);
        this.menuItems = this.ContextMenuElement.querySelectorAll(".context-menu__item");

        document.addEventListener( "contextmenu", function(e)
        {
            this.GridboxElement = this.GetClickedElementIfClassnameValid( e, this.ContextMenuClassName );
            if ( this.GridboxElement )
            {
                e.preventDefault();
            }
        }.bind(this));

        window.onresize = function(e)
        {
            this.ToggleMenuOff();
        }.bind(this);

        $(this.TargetIdName).contextmenu(function(e)
		{
            this.OnClick(e);

        }.bind(this));

        document.addEventListener( "click", function(e)
		{
            this.OnClick(e);

        }.bind(this));

        this.MenuItemSelectionCallback = onContextMenuSelectionCallback;
    }

    GetCursorPosition(e)
    {
        var posx = 0;
        var posy = 0;

        if (!e) var e = window.event;

        if (e.pageX || e.pageY)
        {
            posx = e.pageX;
            posy = e.pageY;
        }

        else if (e.clientX || e.clientY)
        {
            posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }

        return { x: posx, y: posy }
    }

    ToggleMenuOn()
    {
        if ( this.MenuState !== 1 )
        {
            this.MenuState = 1;
            this.ContextMenuElement.classList.add( this.ContextMenuActive );
        }
    }

    ToggleMenuOff()
    {
        if ( this.MenuState !== 0 )
        {
            this.MenuState = 0;
            this.ContextMenuElement.classList.remove( this.ContextMenuActive );
        }
    }

    MoveContextMenu(e)
    {
        var cursorPosition = this.GetCursorPosition(e);

        var menuWidth = this.ContextMenuElement.offsetWidth + 4;
        var menuHeight = this.ContextMenuElement.offsetHeight + 4;

        var windowWidth = window.innerWidth;
        var windowHeight = window.innerHeight;

        if ( (windowWidth - cursorPosition.x) < menuWidth )
        {
            this.ContextMenuElement.style.left = windowWidth - menuWidth + "px";
        }

        else
        {
            this.ContextMenuElement.style.left = cursorPosition.x + "px";
        }

        if ( (windowHeight - cursorPosition.y) < menuHeight )
        {
            this.ContextMenuElement.style.top = windowHeight - menuHeight + "px";
        }
        else
        {
            this.ContextMenuElement.style.top = cursorPosition.y + "px";
        }
    }

    OnMenuItemSelection( selectedItem )
    {
        var selectionString = selectedItem.getAttribute("data-action");
        this.MenuItemSelectionCallback(selectionString);

        this.ToggleMenuOff();
    }

    GetClickedElementIfClassnameValid( e, className )
    {
        var el = e.srcElement || e.target;

        if ( el.classList.contains(className) )
        {
            return el;
        }

        else
        {
            while ( el = el.parentNode )
            {
                if ( el.classList && el.classList.contains(className) )
                {
                    return el;
                }
            }
        }

        return false;
    }

    OnClick(event)
    {
        var button = event.which || event.button;
        var leftClickCode = 1;
        var rightClickCode = 3;

        if(this.MenuState == 0)
        {
            this.GridboxElement = this.GetClickedElementIfClassnameValid(event, this.TargetClassName );
            if ( this.GridboxElement && (button == 3))
            {
                event.preventDefault();
                this.ToggleMenuOn();
                this.MoveContextMenu(event);
            }

            else
            {
                this.GridboxElement = null;
                this.ToggleMenuOff();
            }
        }

        else
        {
            var clickeElIsLink = this.GetClickedElementIfClassnameValid( event, this.ContextMenuLinkClassName );

            if ( clickeElIsLink )
            {
                event.preventDefault();
                this.OnMenuItemSelection( clickeElIsLink );
            }

            else
            {
                var taskElement = this.GetClickedElementIfClassnameValid( event, this.GridBoxClassName );
                if ( button === leftClickCode )
                {
                    this.ToggleMenuOff();
                }
                else if(taskElement && (button === rightClickCode))
                {
                    this.MoveContextMenu(event);
                }
            }
        }
    }
}

class ContextMenuHandler
{
    constructor()
    {
        this.GridBoxClassName = "context-menu-target";

        this.GridboxContextMenu = new ContextMenu("#context-menu-gridpreview", "#GridboxArray", "context-menu-gridpreview-target");
        this.GridboxArrayContextMenu = new ContextMenu("#context-menu-canvas", "#gridbox", "context-menu-canvas-target");
    }

    Initialize(OnContextMenuSelectionCallback)
    {
        this.GridboxContextMenu.Initialize(OnContextMenuSelectionCallback);
        this.GridboxArrayContextMenu.Initialize(OnContextMenuSelectionCallback);
    }
}
