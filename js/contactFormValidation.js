/*global jQuery, window, document, unescape, escape */
window.OnewebContactForm = (function($) {
    var ContactFormValidation;

    /**
     * This function is used to replace special characters to their html entity equivalent
     * so that browser treats them as string and not parse as HTML/Javascript/CSS ONEWEB-8221
     */
    function htmlEncode(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    function getUniqueFieldName(fieldName, existingNames) {
        var uniqueName = fieldName,
            count = 1;
        while (existingNames.indexOf(uniqueName) !== -1) {
            uniqueName = fieldName + '_' + count;
            count++;
        }
        return uniqueName;
    };

    function runPipe(fnPipe, data) {
        return fnPipe.reduce(function(newData, fn) {
            return fn(newData);
        }, data);
    }

    function getErrorMessage(labelList) {
        let formElementErrors = [];

        Array.from(labelList).forEach((element, index) => {
            if (element.innerText.includes("*")) {
                formElementErrors[index] = encodeURIComponent("Please enter a valid data");
            }
        });

        return formElementErrors;
    }

    /**
     * Contact form validation constructor function
     * @param {Object} cfg
     */
    ContactFormValidation = function(cfg) {
        try {
            this.init(cfg);
        } catch (e) {
            throw new Error('ContactForm Validation initialization failed');
        }
    };
    /**
     * ContactFormValidation constructor function's prototype
     * it has helper methods
     * @type {Object}
     */
    ContactFormValidation.prototype = {
        constructor: window.OnewebContactForm, // To prevent JS prototype Gotcha
        init: function(cfg) {
            this.formDOMId = cfg.formDOMId;
            this.postURL = cfg.postURL;
            this.recipientEmail = decodeURIComponent(cfg.recipientEmail);
            this.successMessage = decodeURIComponent(cfg.successMessage);
            this.errorMessage = decodeURIComponent(cfg.errorMessage);
            this.formElementsErrorMessages = JSON.parse(cfg.formElementsErrorMessages);
            this.allFieldErrorMessage = JSON.parse(cfg.allFieldErrorMessage);
            this.emailRegex = new RegExp(cfg.emailRegex, 'i');
            this.urlRegex = new RegExp(cfg.urlRegex);
            this.previewMode = cfg.previewMode;
            this.usePHPSubmitHandler = cfg.usePHPSubmitHandler;
            this.attachSubmitEvent();
            this.formFieldErrors = [];
            this.contactFormDOM = {};
            /* IMPORTANT: Any field added here must also be added in $interalFields in server/lib/handlers/contactform/mailer.php */
            this.formData = {
                recipient: this.recipientEmail,
                email: this.recipientEmail,
                subject: decodeURIComponent(cfg.subject)
            };
            this.defaultFormData = $.extend({}, this.formData);
            this.originalCharset = this.getDocumentCharset();
            this.attachSubmitEvent();
        },

        /**
         * Attach DOM click event
         */
        attachSubmitEvent: function() {
            $('.oneWebCntForm input[type="submit"]').click($.proxy(this.validateForm, this));
        },

        /**
         * Validate Form
         * @param  {Object} event - jQuery DOM event
         */
        validateForm: function(event) {
            event.preventDefault();
            event.stopImmediatePropagation();

            var contactFormId = event.currentTarget.closest("form").id;
            this.removeSuccessMessageOnFormFields($('#' + contactFormId).find('#contactFormResponseContainer'));

            this.contactFormDOM = $('#' + contactFormId);
            this.formDOMId = contactFormId;
            var requiredFieldCount = this.contactFormDOM.find("label");
            this.formElementsErrorMessages = this.allFieldErrorMessage = getErrorMessage(requiredFieldCount);
            this.removeErrorMessageWarningOnFormFields(this.contactFormDOM);
            this.setDocumentCharset("ISO-8859-1"); // FormMail.pl accepts only "ISO-8859-1" format data
            if (this.getFormValidationErrors(this.contactFormDOM) === 0) {
                this.updateFormData(this.contactFormDOM);
                if (this.isHiddenFieldEmpty() && !this.previewMode) {
                    this.postContactForm();
                    this.formData = $.extend(true, {}, this.defaultFormData);
                }
            } else {
                // do nothing if form fields has errors
                var errEl = $('#' + contactFormId).find('.contact-form-field-container .error-message')[0];
                if (errEl) {
                    errEl.scrollIntoView(); // 1st error message should be visible
                }
                this.setDocumentCharset(this.originalCharset);
                return false;
            }
        },
        /**
         * Remove any warning messages on given form
         * @param  {DOM} formDOM  remove warning message in formDOM
         */
        removeErrorMessageWarningOnFormFields: function(formDOM) {
            $(formDOM).find('.error-message').remove();
        },

        /**
         * Remove the success message from top of contact form, before another form validation execution begins.
         * @param {DOM} successMsgDOM   remove message and css class in successMsgDom
         */
        removeSuccessMessageOnFormFields: function(successMsgDOM) {
            $(successMsgDOM).html('').removeClass('formSuccess');
        },
        /**
         * Get Number of Form fields with error and add warning message to
         * each form field which fails validation
         * @param  {DOM} formDOM  to validate
         * @return {Number}  errors Number of form fields with errors
         */
        getFormValidationErrors: function(formDOM) {
            var formFields = formDOM.find('.contact-form-field-container'),
                emailRegex = this.emailRegex,
                urlRegex = this.urlRegex,
                messageRegex = /^\S*/g,
                //numberRegex = this.numberRegex,
                errors = 0;

            $.each(formFields, $.proxy(function(index, element) {
                var errorMessage = this.formElementsErrorMessages[index],
                    inputFieldVal,
                    errorFound = false,
                    text;

                // var $numberField = $(element).find(this.numberQuery),
                //     isNumberField = $numberField.length === 1;

                // Using "&&" to retain the falsy value if "errorMessage" is falsy
                errorMessage = errorMessage && decodeURIComponent(errorMessage);
                if ($(element).find('input[type="text"]')[0] && errorMessage) {
                    text = $.trim($(element).find('input[type="text"]').val());
                    if (!text.length && text.match(messageRegex)) {
                        errorFound = true;
                    }
                } else if ($(element).find('input[type="email"]')[0]) { // form validation check for email field
                    inputFieldVal = $(element).find('input[type="email"]').val();
                    if (errorMessage || inputFieldVal) {
                        errorMessage = errorMessage || decodeURIComponent(this.allFieldErrorMessage[index]);
                        if (!emailRegex.test(inputFieldVal)) {
                            errorFound = true;
                        }
                    }
                } else if ($(element).find('input[type="url"]')[0]) { // form validation check for website / url
                    inputFieldVal = $(element).find('input[type="url"]').val();
                    if (errorMessage || inputFieldVal) {
                        errorMessage = errorMessage || decodeURIComponent(this.allFieldErrorMessage[index]);
                        if (!urlRegex.test(inputFieldVal) && !urlRegex.test('http://' + inputFieldVal)) {
                            errorFound = true;
                        }
                    }
                } else if ($(element).find('input[type="checkbox"]').length > 0 && errorMessage) { // form validation check for checkbox
                    if (!$(element).find('input[type="checkbox"]:checked')[0]) {
                        errorFound = true;
                    }
                } else if ($(element).find('input[type="radio"]').length > 0 && errorMessage) { // form validation check for Radio checkboxes
                    if (!$(element).find('input[type="radio"]:checked')[0]) {
                        errorFound = true;
                    }
                } else if ($(element).find("textarea")[0] && errorMessage) { // form validation check for text message
                    text = $.trim($(element).find("textarea").val());
                    if (!text.length && text.match(messageRegex)) {
                        errorFound = true;
                    }
                } else if ($(element).find('select')[0] && errorMessage) { //FIXME no need of validation for dropdown
                    var selectedValue = $(element).find('select').val();
                    if (!selectedValue && (selectedValue !== '--')) {
                        errorFound = true;
                    }
                }
                var errContainer = $(element).prev();
                if (errorFound) {
                    errContainer.html(htmlEncode(errorMessage));
                    errors = errors + 1;
                } else {
                    errContainer.html('&nbsp;');
                }
            }, this));

            return errors;
        },
        /**
         * Update formData from form values,
         * formData is used in the AJAX post
         * @param  {DOM} formDOM  get form field values from formDOM
         */
        updateFormData: function(formDOM) {
            var formFields = $(formDOM).find('.contact-form-field-container'),
                existingNames = Object.keys(this.formData);
            $.each(formFields, $.proxy(function(index, element) {
                var labelName = $(element).find('label').attr('data-label');
                labelName = getUniqueFieldName(labelName, existingNames);
                existingNames.push(labelName);
                if ($(element).find('input[type="email"]')[0]) {
                    labelName = labelName === 'email' ? 'Email' : labelName;
                    if (!this.formData.replyto) { //in case user added two email fields.
                        this.formData.replyto = this.formData[labelName] = $(element).find("input").val();
                    } else {
                        this.formData[labelName] = $(element).find("input").val();
                    }
                } else if ($(element).find('input[type="text"]')[0] || $(element).find('input[type="url"]')[0]) {
                    this.formData[labelName] = $(element).find("input").val();
                } else if ($(element).find("textarea")[0]) {
                    this.formData[labelName] = $(element).find("textarea").val();
                }
            }, this));
        },
        /**
         * jQuery doesn't handle "ISO-8859-1" encoding. ONEWEB-6724
         * Do explicit "ISO-8859-1" encoding.
         * @return {String} encodedFormData
         */
        getEncodedFormData: function() {
            var encodedFormData = '';

            var replacePlus = function(data) {
                return data.replace(/\+/g, "%2B");
            };

            // IMPORTANT: When the mail is to be handled by PHP, do not use escape+unescape on the data
            var fnPipe = this.usePHPSubmitHandler ? [encodeURIComponent, replacePlus] : [escape, encodeURIComponent, unescape, replacePlus];

            for (var key in this.formData) {

                /* Workaround for WBTGEN-8772 - Sending name (key) ending with something like xx[yyy] results in error.
                    Why it happens is explained here https://github.com/ljharb/qs/issues/235
                */
                var newKey = key;
                newKey = key.replace(/[\[\]]+/g, '_');

                encodedFormData += runPipe(fnPipe, newKey) + "=" + runPipe(fnPipe, this.formData[key]) + "&";
            }
            // trim last character "&"
            encodedFormData = encodedFormData.substring(0, encodedFormData.length - 1);

            return encodedFormData;
        },
        /**
         * check if hidden field is empty
         * @return {Boolean}
         */
        isHiddenFieldEmpty: function() {
            var element = $(this.contactFormDOM).find('.contact-form-field-container>input[name="some-randome-random"]');
            return (element.text() === '' && element.val() === "");
        },
        /**
         * Post contactForm data
         * @param  {Object} data [description]
         */
        postContactForm: function() {
            $.ajax({
                type: "POST",
                url: this.postURL,
                beforeSend: function(xhr) {
                    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                },
                data: this.getEncodedFormData(),
                success: $.proxy(this.ajaxSuccess, this),
                error: $.proxy(this.ajaxError, this)
            });
        },
        /**
         * display success message
         * @private
         */
        ajaxSuccess: function(responseText) {
            var responseStatus = $('#' + this.formDOMId).find("#contactFormResponseContainer")[0];;

            if (/<title>\s*Error/i.test(responseText)) {
                $(responseStatus).html(htmlEncode(this.errorMessage)).addClass('formError').removeClass('formSuccess');
            } else {
                $(responseStatus).html(htmlEncode(this.successMessage)).addClass('formSuccess').removeClass('formError');
                this.trackFormSubmit();
            }

            this.resetDocument();
        },
        /**
         * display error message
         * @private
         */
        ajaxError: function() {
            var responseStatus = $('#' + this.formDOMId).find("#contactFormResponseContainer")[0];
            $(responseStatus).html(this.errorMessage).addClass('formError');
        },
        /**
         * Update document charset and reset form
         * @private
         */
        resetDocument: function() {
            $(this.contactFormDOM).trigger("reset");
            this.setDocumentCharset(this.originalCharset);
        },
        /**
         * Get characterSet of the page document
         * @return {String} charset of the page
         */
        getDocumentCharset: function() {
            // Firefox latest version - 33 doesn't have document.charset
            return document.characterSet || document.charset;
        },
        /**
         * Set characterSet for the page document
         * @param {String} charset
         */
        setDocumentCharset: function(charset) {
            if (document.charset) {
                document.charset = charset;
            } else {
                document.characterSet = charset;
            }
        },
        /**
         * Track Contact form Submission
         */
        trackFormSubmit: function() {
            const sw = window.sw;
            if (sw && sw.register_contact_form) {
                sw.register_contact_form();
            }
        }

    };

    return ContactFormValidation;
}(jQuery));