/* eslint-disable no-var */
/*global jQuery, window, document */
window.WebshopHideMenuItems = (function($) {
    var version = "5";
    var webshopFileName = "online-store.html";
    var webshopTitle = "Online Shop";
    var menuHideClass = 'ws-hide-menu';
    if (!webshopFileName) {
        return;
    }

    function addWebshopClasses() {
        const style = document.createElement('style');
        style.innerHTML = '.' + menuHideClass + ' { display: none !important }';
        document.head.appendChild(style);
    }

    function isMenuItemHasWebshopLink(menuItem) {
        return menuItem.find('a[href="' + webshopFileName + '"]')[0];
    }

    function processV5Page() {
        $('.normal-menu, ul, .menu-more-items, .ss-pagemenu__desktop__page-list').each(function() {
            var menu = $(this);
            var foundWebshopLink = false;
            menu.children().each(function() {
                var menuItem = $(this);
                var hasWebshopLink = isMenuItemHasWebshopLink(menuItem);
                if (hasWebshopLink) {
                    $(hasWebshopLink).siblings().each(function() {
                        var sibling = $(this);
                        sibling.addClass(menuHideClass);
                    });
                    var caret = menuItem.find('i')[0];
                    if (caret) {
                        $(caret).next().remove();
                        $(caret).remove();
                    }
                    if (foundWebshopLink) {
                        menuItem.addClass(menuHideClass);
                    } else if (webshopTitle) {
                        hasWebshopLink.innerText = webshopTitle;
                    }
                    foundWebshopLink = true;
                }
            });
        });
    }
    addWebshopClasses();
    switch (version) {
        case "2":
        case "4":
        case "3":
        case "5":
        default:
            processV5Page();
            break;
    }
}(jQuery));