import { MarkEdit } from 'markedit-api';
import { showVersionBrowser } from './src/browser';

MarkEdit.addMainMenuItem({
  title: 'Browse Versions',
  icon: 'clock.arrow.circlepath',
  action: showVersionBrowser,
});
