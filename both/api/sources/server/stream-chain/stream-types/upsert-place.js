import EventStream from 'event-stream';
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { PlaceInfos } from '/both/api/place-infos/place-infos';
import { ObjectProgressStream } from '../object-progress-stream';

const upsert = Meteor.bindEnvironment((onDebugInfo, ...args) => {
  try {
    PlaceInfos.upsert(...args);
  } catch (error) {
    if (onDebugInfo) {
      onDebugInfo({
        reason: error.reason,
        stack: error.stack,
      });
    }
  }
});

// TODO: Refactor this, this is almost the same as InsertPlace
export class UpsertPlace {
  constructor({ sourceId, sourceImportId, onDebugInfo, onProgress }) {
    check(sourceId, String);
    check(sourceImportId, String);
    check(onDebugInfo, Function);
    check(onProgress, Function);

    let skippedRecordCount = 0;

    this.stream = EventStream.map((placeInfo, callback) => {
      const originalId = placeInfo.properties.originalId;

      if (!originalId) {
        skippedRecordCount++;
        callback(null, placeInfo);
        return placeInfo;
      }

      check(originalId, String);

      Object.assign(placeInfo.properties, { sourceId, sourceImportId });
      upsert(onDebugInfo, {
        'properties.sourceId': sourceId,
        'properties.originalId': originalId,
      }, placeInfo);
      callback(null, placeInfo);
      return placeInfo;
    });

    this.stream.on('finish', () => {
      onDebugInfo({
        skippedRecordWarning: `Skipped ${skippedRecordCount} PlaceInfo records without originalId.`,
      });
    });

    this.progressStream = new ObjectProgressStream(this.stream, onProgress);
  }
}
