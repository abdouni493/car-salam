/**
 * Open a generated document in a print window and only fire the print dialog once
 * every asset it references is settled.
 *
 * `window.print()` snapshots the document as-is: called straight after
 * `document.write()`, remote images (agency logo, car photo served from Supabase
 * storage) are still in-flight and print as blank boxes.
 */

/** A slow or unreachable asset must not hold the print dialog hostage. */
const ASSET_TIMEOUT_MS = 5000;

const waitForImages = (doc: Document): Promise<void> => {
  const pending = Array.from(doc.images).filter(img => !img.complete);
  if (pending.length === 0) return Promise.resolve();

  const settled = pending.map(
    img =>
      new Promise<void>(resolve => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      })
  );

  return Promise.race([
    Promise.all(settled).then(() => undefined),
    new Promise<void>(resolve => setTimeout(resolve, ASSET_TIMEOUT_MS)),
  ]);
};

export const printHTMLDocument = (content: string): void => {
  const printWindow = window.open('', '', 'height=600,width=800');
  if (!printWindow) return;

  printWindow.document.write(content);
  printWindow.document.close();

  void waitForImages(printWindow.document).then(() => {
    // The user may have closed the popup while the assets were loading.
    if (printWindow.closed) return;
    printWindow.focus();
    printWindow.print();
  });
};
