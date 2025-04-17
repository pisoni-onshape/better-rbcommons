      function customPrompt(message, defaultValue = '') {
          return new Promise((resolve) => {
              // --- Create DOM Elements ---

              // 1. Overlay
              const overlay = document.createElement('div');
              overlay.className = 'custom-prompt-overlay';

              // 2. Dialog Box
              const dialog = document.createElement('div');
              dialog.className = 'custom-prompt-dialog';

              // 3. Message
              const msgElement = document.createElement('p');
              msgElement.textContent = message;

              // 4. Input Field
              const input = document.createElement('input');
              input.type = 'text';
              input.value = defaultValue;

              // 5. Button Container
              const buttonContainer = document.createElement('div');
              buttonContainer.className = 'buttons';

              // 6. OK Button
              const okButton = document.createElement('button');
              okButton.textContent = 'OK';
              okButton.className = 'ok-button';

              // 7. Cancel Button
              const cancelButton = document.createElement('button');
              cancelButton.textContent = 'Cancel';
              cancelButton.className = 'cancel-button';

              // --- Assemble Dialog ---
              buttonContainer.appendChild(cancelButton); // Cancel usually comes first visually on right
              buttonContainer.appendChild(okButton);
              dialog.appendChild(msgElement);
              dialog.appendChild(input);
              dialog.appendChild(buttonContainer);
              overlay.appendChild(dialog);

              // --- Event Handlers ---

              // Function to close the dialog and clean up
              const closeDialog = (value) => {
                  document.removeEventListener('keydown', handleKeydown); // Remove global listener
                  document.body.removeChild(overlay);
                  resolve(value);
              };

              // OK button click
              okButton.addEventListener('click', () => {
                  closeDialog(input.value);
              });

              // Cancel button click
              cancelButton.addEventListener('click', () => {
                  closeDialog(null);
              });

              // Handle Enter key in input field
              input.addEventListener('keydown', (e) => {
                  if (e.key === 'Enter') {
                      e.preventDefault(); // Prevent potential form submission
                      okButton.click(); // Simulate OK click
                  } else if (e.key === 'Escape') {
                      cancelButton.click(); // Simulate Cancel click
                  }
              });

              // Handle Escape key globally to cancel
              const handleKeydown = (e) => {
                  if (e.key === 'Escape') {
                      cancelButton.click();
                  }
              };
              document.addEventListener('keydown', handleKeydown);


              // --- Show Dialog ---
              document.body.appendChild(overlay);

              // Focus the input field and select its content
              input.focus();
              input.select();
          });
      }
