/* global contract beforeEach it assert */

const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const { EMPTY_SCRIPT } = require('@aragon/test-helpers/evmScript')
const { getEventAt } = require('@aragon/test-helpers/events')
const { defaultParams, deployAllAndInitializeApp, VOTE, BIG_ZERO } = require('./helpers/deployApp')

const VOTER_BALANCE = web3.toBigNumber('100e18')
const MILLION = 1000000

contract('HCVoting (vote)', ([appManager, voter1, voter2, voter3, voter4]) => {
  let app, voteToken

  before('deploy app', async () => {
    ({ app, voteToken } = await deployAllAndInitializeApp(appManager))
  })

  it('should revert when voting on a proposal that doesn\'t exist', async () => {
    await assertRevert(
      app.vote(0, true, { fom: voter1 }),
      'HCVOTING_PROPOSAL_DOES_NOT_EXIST'
    )
  })

  describe('when a proposal exists', () => {
    let creationDate

    const calculateSupport = (numVotes, numVoters) => {
      return Math.floor(numVotes * MILLION / numVoters)
    }

    before('mint some tokens', async () => {
      await voteToken.generateTokens(voter1, VOTER_BALANCE)
      await voteToken.generateTokens(voter2, VOTER_BALANCE)
      await voteToken.generateTokens(voter3, VOTER_BALANCE)
      // Intentionally not minting to voter4.
    })

    before('create a proposal', async () => {
      await app.propose(EMPTY_SCRIPT, 'Proposal metadata 0')
      creationDate = (await app.getCreationDate(0)).toNumber()
    })

    it('should not allow a user with no voting power to vote', async () => {
      await assertRevert(
        app.vote(0, true, { from: voter4 }),
        'HCVOTING_NO_VOTING_POWER'
      )
    })

    describe('when voter1 casts a Nay vote on the proposal', () => {
      let voteReceipt

      before('cast vote', async () => {
        voteReceipt = await app.vote(0, false, { from: voter1 })
      })

      it('should emit a VoteCasted event with the appropriate data', async () => {
        const voteEvent = getEventAt(voteReceipt, 'VoteCasted')
        assert.equal(voteEvent.args.proposalId.toNumber(), 0, 'invalid proposal id')
        assert.equal(voteEvent.args.voter, voter1, 'invalid voter')
        assert.equal(voteEvent.args.supports, false, 'invalid vote support')
      })

      it('registers the correct totalYeas/totalNays', async () => {
        assert.deepEqual(await app.getTotalYeas(0), BIG_ZERO, 'invalid yeas')
        assert.deepEqual(await app.getTotalNays(0), VOTER_BALANCE, 'invalid nays')
      })

      it('should record the user\'s vote as Nay', async () => {
        assert.equal((await app.getUserVote(0, voter1)).toNumber(), VOTE.NAY)
      })

      it('calculates the correct absolute support', async () => {
        assert.equal((await app.getSupport(0, true, false)).toNumber(), calculateSupport(0, 3), 'incorrect absolute positive support')
        assert.equal((await app.getSupport(0, false, false)).toNumber(), calculateSupport(1, 3), 'incorrect absolute negative support')
      })

      it('calculates the correct absolute consensus', async () => {
        assert.equal((await app.getConsensus(0, false)).toNumber(), VOTE.ABSENT, 'incorrect absolute consensus')
      })

      it('does not allow voter1 to vote again', async () => {
        await assertRevert(
          app.vote(0, true, { from: voter1 }),
          'HCVOTING_ALREADY_VOTED'
        )
        await assertRevert(
          app.vote(0, false, { from: voter1 }),
          'HCVOTING_ALREADY_VOTED'
        )
      })

      describe('when voter2 casts a Yea vote on the proposal', () => {
        before('cast vote', async () => {
          await app.vote(0, true, { from: voter2 })
        })

        it('should record the user\'s vote as Yea', async () => {
          assert.equal((await app.getUserVote(0, voter2)).toNumber(), VOTE.YEA)
        })

        it('registers the correct totalYeas/totalNays', async () => {
          assert.deepEqual(await app.getTotalYeas(0), VOTER_BALANCE, 'invalid yeas')
          assert.deepEqual(await app.getTotalNays(0), VOTER_BALANCE, 'invalid nays')
        })

        it('calculates the correct absolute support', async () => {
          assert.equal((await app.getSupport(0, true, false)).toNumber(), calculateSupport(1, 3), 'incorrect absolute positive support')
          assert.equal((await app.getSupport(0, false, false)).toNumber(), calculateSupport(1, 3), 'incorrect absolute negative support')
        })

        it('calculates the correct absolute consensus', async () => {
          assert.equal((await app.getConsensus(0, false)).toNumber(), VOTE.ABSENT, 'incorrect absolute consensus')
        })

        describe('when voter1 transfers its tokens to voter4', () => {
          before('transfer tokens', async () => {
            await voteToken.transfer(voter4, VOTER_BALANCE, { from: voter1 })
          })

          after('return tokens', async () => {
            await voteToken.transfer(voter1, VOTER_BALANCE, { from: voter4 })
          })

          it('reverts when voter4 attempts to vote on the proposal', async () => {
            await assertRevert(
              app.vote(0, true, { from: voter4 }),
              'HCVOTING_NO_VOTING_POWER'
            )
          })
        })

        describe('when the vote token supply increases after the proposal was created', () => {
          before('mint tokens', async () => {
            await voteToken.generateTokens(voter4, VOTER_BALANCE)
          })

          it('calculated absolute support does not change', async () => {
            assert.equal((await app.getSupport(0, true, false)).toNumber(), calculateSupport(1, 3), 'incorrect absolute positive support')
            assert.equal((await app.getSupport(0, false, false)).toNumber(), calculateSupport(1, 3), 'incorrect absolute negative support')
          })

          it('calculates absolute consensus does not change', async () => {
            assert.equal((await app.getConsensus(0, false)).toNumber(), VOTE.ABSENT, 'incorrect absolute consensus')
          })

          describe('when another proposal is created and multiple votes are casted on it', () => {
            before('create another proposal', async () => {
              await app.propose(EMPTY_SCRIPT, 'Proposal metadata 1')
            })

            before('cast multiple votes', async () => {
              await app.vote(1, true, { from: voter1 })
              await app.vote(1, false, { from: voter2 })
              await app.vote(1, false, { from: voter3 })
              await app.vote(1, false, { from: voter4 })
            })

            it('registers the correct totalYeas/totalNays', async () => {
              assert.deepEqual(await app.getTotalYeas(1), VOTER_BALANCE, 'invalid yeas')
              assert.deepEqual(await app.getTotalNays(1), VOTER_BALANCE.mul(3), 'invalid nays')
            })

            it('registers each user\'s vote', async () => {
              assert.equal((await app.getUserVote(1, voter1)).toNumber(), VOTE.YEA)
              assert.equal((await app.getUserVote(1, voter2)).toNumber(), VOTE.NAY)
              assert.equal((await app.getUserVote(1, voter3)).toNumber(), VOTE.NAY)
              assert.equal((await app.getUserVote(1, voter4)).toNumber(), VOTE.NAY)
            })

            it('calculates the correct absolute support', async () => {
              assert.equal((await app.getSupport(1, true, false)).toNumber(), calculateSupport(1, 4), 'incorrect absolute positive support')
              assert.equal((await app.getSupport(1, false, false)).toNumber(), calculateSupport(3, 4), 'incorrect absolute negative support')
            })

            it('calculates the correct absolute consensus', async () => {
              assert.equal((await app.getConsensus(1, false)).toNumber(), VOTE.NAY, 'incorrect absolute consensus')
            })
          })
        })

        describe('when the proposal is closed', () => {
          before('shift time to after queuePeriod', async () => {
            await app.mockSetTimestamp(creationDate + defaultParams.queuePeriod)
          })

          after('shift time back to when the proposal was created', async () => {
            await app.mockSetTimestamp(creationDate)
          })

          it('reverts when voter3 attempts to vote', async () => {
            await assertRevert(
              app.vote(0, false, { from: voter3 }),
              'HCVOTING_PROPOSAL_IS_CLOSED'
            )
          })
        })

        describe('when voter3 casts a Yea vote on the proposal', () => {
          before('cast vote', async () => {
            await app.vote(0, true, { from: voter3 })
          })

          it('should record the user\'s vote as Yea', async () => {
            assert.equal((await app.getUserVote(0, voter3)).toNumber(), VOTE.YEA)
          })

          it('registers the correct totalYeas/totalNays', async () => {
            assert.deepEqual(await app.getTotalYeas(0), VOTER_BALANCE.mul(2), 'invalid yeas')
            assert.deepEqual(await app.getTotalNays(0), VOTER_BALANCE, 'invalid nays')
          })

          it('calculates the correct absolute support', async () => {
            assert.equal((await app.getSupport(0, true, false)).toNumber(), calculateSupport(2, 3), 'incorrect absolute positive support')
            assert.equal((await app.getSupport(0, false, false)).toNumber(), calculateSupport(1, 3), 'incorrect absolute negative support')
          })

          it('calculates the correct absolute consensus', async () => {
            assert.equal((await app.getConsensus(0, false)).toNumber(), VOTE.YEA, 'incorrect absolute consensus')
          })

          describe('when the proposal is resolved', () => {
            before('resolve proposal', async () => {
              await app.resolve(0)
            })

            it('reverts when voter3 attempts to vote', async () => {
              await assertRevert(
                app.vote(0, false, { from: voter3 }),
                'HCVOTING_PROPOSAL_IS_RESOLVED'
              )
            })
          })
        })
      })
    })
  })
})
