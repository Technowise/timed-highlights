# Timed-Highlights 📅 📌
This is a moderation tool for creating timed-highlight posts in your community. The tool adds a menu option for moderators to create timed highlight/sticky posts in the community. Once the given number of days are elapsed, the post will be automatically unstickied/removed from highlights ( so moderators need not remember to unsticky/remove from highlights later).

![Add to Timed Highlights 📅 📌](https://styles.redditmedia.com/t5_bu9llw/styles/image_widget_l2or2sdwk36f1.png)

![Add to Timed Highlights Form](https://styles.redditmedia.com/t5_bu9llw/styles/image_widget_d7k4vb069z8f1.jpg)

### Install the app:
Moderators can install the app to their subreddit by going to [https://developers.reddit.com/apps/timed-highlights](https://developers.reddit.com/apps/timed-highlights)

### Creating Timed Highlights:
1) Go to any post on your subreddit, and click on the three-dot menu[...] on mobile, or moderator actions [⛉] menu on browser view, and select "Add to Timed Highlights 📅 📌".
2) You will be presented with a form to enter the number of days to keep it in highlights, and the position for the highlight.
3) After you submit the form, the post will be added as highlight in your community, and it would be removed from highlights after the specified number of days are elapsed. Please make sure to refresh the page manually

### App Settings
There are two settings available in the app. 
1) Default number of days to be shown in the Timed-Highlight input form.
1) Flag to enable/disable adding of informational comment on the highlight time-period to the post.
3) Flag to enable/disable mod-mail notification on removal of the post from highlight.

## Changelog
* 0.0.1
  * Initial version with feature to add posts as Timed-Highlights to the community.
* 0.0.3
  * Add settings to configure the default number of days to show in form, and to enable/disable informational comment from the app for posts.
* 0.0.4
  * Add mod-mail notification on removal of post from highlight, and add configuration option to enable/disable notification.
* 0.0.5
  * Added hours option for highlights (includes form field, and respective settings field for default number of hours).
* 0.0.6
  * Update the devvit public-api package version to 0.11.18
