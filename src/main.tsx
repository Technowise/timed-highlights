Devvit.configure({redditAPI: true, 
                  redis: true,
                  userActions: false });

import { Devvit } from '@devvit/public-api';
type positionRange = 1|2|3|4;

type timedHighlight = {
  postId: string,
  expireTime: number
}

Devvit.addTrigger({
  event: 'PostDelete',
  onEvent: async (event, context) => {
    const {redis} = context;
    console.log(`Received PostDelete event:\n${JSON.stringify(event)}`);
    var postHash = await context.redis.hGet('timedHighlights',event.postId);
    if( postHash && postHash.length > 0 ) { //Delete respective hash if it exists for the deleted post.
      context.redis.hDel('timedHighlights', [event.postId]);
      console.log("Deleted hash of deleted post id "+event.postId );
    }
  },
});

Devvit.addSchedulerJob({
  name: 'remove-expired-highlights',  
  onRun: async(event, context) => {
    console.log("Starting the Timed-Highlights scheduled cron job...");
    let dateNow = new Date();
    var presentTimedHighlightsHashes = await context.redis.hGetAll('timedHighlights');
    
    if (presentTimedHighlightsHashes && Object.keys(presentTimedHighlightsHashes).length > 0) {
      for (const key in presentTimedHighlightsHashes) {
        const HLObj:timedHighlight = JSON.parse(presentTimedHighlightsHashes[key]);
        if( dateNow.getTime() > HLObj.expireTime ) {
          console.log("Expired highlight post: ");
          console.log(HLObj);
    
          try {
            const post = await context.reddit.getPostById(HLObj.postId);
            if( post.isStickied() ) {
              await post.unsticky();
              console.log("Unstickied post: "+HLObj.postId);
            }

            var removedItemsCount = await context.redis.hDel('timedHighlights', [HLObj.postId]);
            if( removedItemsCount > 0 ) {
              console.log("removed "+HLObj.postId+" from redis");
            }
          }
          catch(err) {
            console.log("There was an error unstickying the post. "+ (err as Error).message);
          }

        }
      }
    }

  },
});

const highlightsForm = Devvit.createForm(
  {
    title: 'Add to Timed Highlights 📅 📌',
    fields: [
      {
        type: 'number',
        name: 'days',
        label: 'Number of days',
        defaultValue: 1,
        required: true,
        helpText: "Number of days to keep in highlights.",
      },
      {
        type: 'select',
        name: 'position',
        label: 'Position',
        options: [{'label': '1', value: '1'},
                  {'label': '2', value: '2'},
                  //Presently 3 and 3 options are not working with post.sticky method. Need to contact reddit support on this.
                  //{'label': '3', value: '3'},
                  //{'label': '4', value: '4'}
                ],
        helpText: "Position in highlights.",
        defaultValue: ['1'],
        required: true,
      }
    ],
    acceptLabel: 'Submit',
  },
  async(event, context) => {
    if( event.values.days > 365  || event.values.days < 1 ) { //Validate input for days.
      context.ui.showToast({
        text: `Please enter a value between 1 and 365 for days. Submission failed.`,
        appearance: 'neutral',
      });
      return;
    }

    var givenPosition = '1';
    if( event.values.position ) {
      givenPosition = event.values.position[0];
      console.log("Position given:"+ event.values.position[0]);
    }
    
    var pos:positionRange;
    switch (givenPosition) {
      case '1':
        pos = 1;
        break;
      case '2':
        pos = 2;
        break;
        /*
       case '3':
        pos = 3;
        break;
      case '4':
        pos = 4;
        break;
        */
      default:
        pos = 1;
        break;   
    }

    await createOrUpdateHighlight ( context, event.values.days, pos)
  }
);

async function createOrUpdateHighlight(context:Devvit.Context, days:number, position:positionRange) {

  var postId = context.postId ?? 'defaultPostId';
  var succeeded = true;

  if ( postId != 'defaultPostId' ) {
    const post = await context.reddit.getPostById(postId);
    try {
      await post.sticky(position);
    }
    catch(err) {
      console.log("There was an error stickying the post. "+ (err as Error).message);
      succeeded = false;
    }
  }
  
  let dateNow = new Date();
  let daysOffsetMs = 86400000 * days;
  let expireDate = new Date( dateNow.getTime() + daysOffsetMs);

  if( succeeded ) {
    const newHL:timedHighlight = {postId: postId, expireTime:expireDate.getTime() };
    await context.redis.hSet('timedHighlights', { [postId]: JSON.stringify(newHL) });

    context.ui.showToast(
      `Post has been highlighted/sticked for ${days} days.`
    );

    const oldJobId = await context.redis.get('removeHighlightsJobId');

    if( !oldJobId || oldJobId.length == 0 ) {//Add cron job to remove highlights if it does not exist already.
      const jobId = await context.scheduler.runJob({
      name: 'remove-expired-highlights',
        cron: '0 * * * *', //Runs every hour once.
      });
      await context.redis.set('removeHighlightsJobId', jobId);
    }

    const subreddit = await context.reddit.getCurrentSubreddit();
    context.ui.navigateTo(subreddit);
  } 
  else {
      context.ui.showToast(
      `Encountered an error while adding the post to highlights. Please contact /u/technowise with details for support.`
    );
  }
}

Devvit.addMenuItem({
  location: 'post',
  label: 'Add to Timed Highlights 📅 📌',
  onPress: (event, context) => {
    context.ui.showForm(highlightsForm);
  },
  forUserType: 'moderator'
});

export default Devvit;
