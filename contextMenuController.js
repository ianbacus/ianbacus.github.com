
let ctx_this = undefined;

class ContextMenuHandler
{
    constructor()
    {
        ctx_this = this
        this.MenuState = 0;
        this.ContextMenuClassName = "context-menu";
        this.ContextMenuItemClassName = "context-menu__item";
        this.ContextMenuLinkClassName = "context-menu__link";
        this.ContextMenuActive = "context-menu--active";

        this.GridBoxClassName = "context-menu-target";
        this.GridboxElement;

        this.ContextMenuElement;
    }

    Initialize(OnContextMenuSelectionCallback)
    {
        this.ContextMenuElement = document.querySelector("#context-menu");
        this.menuItems = this.ContextMenuElement.querySelectorAll(".context-menu__item");

        document.addEventListener( "contextmenu", function(e)
        {
            ctx_this.GridboxElement = ctx_this.GetClickedElementIfClassnameValid( e, this.ContextMenuClassName );

            if ( ctx_this.GridboxElement )
            {
                e.preventDefault();
            }
        });

        document.addEventListener( "click", function(e)
        {
            ctx_this.OnClick(e);

        });

        window.onresize = function(e)
        {
            ctx_this.ToggleMenuOff();
        };

        this.MenuItemSelectionCallback = OnContextMenuSelectionCallback;
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

        return {
            x: posx,
            y: posy
        }
    }

    OnClick(event)
    {
        var button = event.which || e.button;
        var leftClickCode = 1;
        var rightClickCode = 3;

        if(this.MenuState == 0)
        {
            this.GridboxElement = this.GetClickedElementIfClassnameValid(event, this.GridBoxClassName );
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
        var selectionString = selectedItem.getAttribute("data-action")
        this.MenuItemSelectionCallback(selectionString);

        this.ToggleMenuOff();
    }

}
