"""Offline reward-index normalization of a frozen model snapshot.

Not a live migration, custody implementation or authority mechanism. Every
account must be processed before export; work/storage remain O(account count).
"""
import copy
import runpy
from pathlib import Path

M = runpy.run_path(str(Path(__file__).with_name('staking_fixed_model.py')))


class Checkpoint:
    def __init__(self, source):
        self._source = copy.deepcopy(source)
        self._target = copy.deepcopy(source)
        self.cursor = 0
        self.count = len(source.stakes)
        if not self.count:
            raise ValueError('EMPTY')
        # A source checkpoint is a frozen accounting state, not a reference to
        # an object that can change while batches are processed.

    def step(self, expected_cursor, limit):
        if type(expected_cursor) is not int or expected_cursor != self.cursor:
            raise ValueError('CURSOR')
        if type(limit) is not int or not 1 <= limit <= 64:
            raise ValueError('BATCH_LIMIT')
        if self.cursor == self.count:
            raise ValueError('COMPLETE')
        end = min(self.count, self.cursor + limit)
        # Compute the entire batch before committing any changes.
        accrued = [self._source.pending(i) for i in range(self.cursor, end)]
        for i, amount in zip(range(self.cursor, end), accrued):
            self._target.credit[i] = amount
            self._target.debt[i] = 0
        self.cursor = end
        return self.cursor

    def finish(self):
        if self.cursor != self.count:
            raise ValueError('INCOMPLETE')
        result = copy.deepcopy(self._target)
        result.index = 0
        return result
